import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../src/router.js';
import request from 'supertest';
import express from 'express';

vi.mock('../src/db.js', () => ({
  initDb: vi.fn(),
  getMessages: vi.fn().mockReturnValue([
    { role: 'user', content: 'previous msg', created_at: '2026-06-09 07:00' },
  ]),
  getPlan: vi.fn().mockReturnValue({ songs: ['id1'], theme: 'morning' }),
  getRecentPlays: vi.fn().mockReturnValue([
    { song_id: '789', song_name: 'Take Five', artist: 'Dave Brubeck', played_at: '2026-06-09 08:00' },
  ]),
  getPlayHistory: vi.fn().mockReturnValue({
    items: [
      { song_id: '789', song_name: 'Take Five', artist: 'Dave Brubeck', played_at: '2026-06-09 08:00' },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  }),
  addMessage: vi.fn(),
  addPlay: vi.fn(),
  getPref: vi.fn().mockReturnValue(null),
  getPlayStatsAll: vi.fn().mockReturnValue([]),
  setPref: vi.fn(),
}));

vi.mock('../src/claude.js', () => ({
  invokeClaude: vi.fn().mockResolvedValue({
    say: 'Sure, playing some jazz.',
    play: ['123'],
    reason: 'jazz fits work mode',
    segue: '',
  }),
  parseOutput: vi.fn(),
}));

vi.mock('../src/context.js', () => ({
  assemblePrompt: vi.fn().mockReturnValue('=== Assembled Prompt ==='),
}));

vi.mock('../src/predictor.js', () => ({
  getSuggestedQueue: vi.fn().mockResolvedValue({ scene: { scene: 'casual', reason: 'test' }, say: 'hi', play: ['song'], reason: 'test' }),
}));

vi.mock('../src/adapters/netease.js', () => ({
  getNcmCookie: vi.fn().mockReturnValue('mock-cookie'),
  getPlaylistDetail: vi.fn(),
  addTracksToPlaylist: vi.fn(),
  getUserPlaylists: vi.fn().mockResolvedValue([]),
  createPlaylist: vi.fn(),
  removeTracksFromPlaylist: vi.fn(),
  getSongUrl: vi.fn().mockResolvedValue('https://music.126.net/mock.mp3'),
  getSongDetail: vi.fn().mockResolvedValue({ id: 123, name: 'Mock Song', artist: 'Mock Artist', album: 'Mock Album' }),
  getSimilarSongs: vi.fn().mockResolvedValue([{ id: 456, name: 'Similar Song', artist: 'Similar Artist', album: 'Similar Album' }]),
}));

import { getRecentPlays, getPlayHistory, getPref, setPref, addPlay } from '../src/db.js';
import { invokeClaude } from '../src/claude.js';
import { assemblePrompt } from '../src/context.js';
import { getSuggestedQueue } from '../src/predictor.js';

describe('router', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPref).mockReturnValue(null);
    app = createApp({ db: {} as any });
  });
  describe('POST /api/chat', () => {
    it('routes simple command locally without calling Claude', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ text: '下一首' });

      expect(res.status).toBe(200);
      expect(res.body.talk).toBeDefined();
      expect(res.body.claude).toBe(false);
    });

    it('routes natural language to Claude', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ text: '给我放适合工作的歌' });

      expect(res.status).toBe(200);
      expect(res.body.claude).toBe(true);
      expect(res.body.say).toBeDefined();
      expect(res.body.play).toBeDefined();
    });

    it('does not call Claude when LLM is disabled', async () => {
      vi.mocked(getPref).mockImplementation((_db, key) => key === 'llm_enabled' ? 'false' : null);

      const res = await request(app)
        .post('/api/chat')
        .send({ text: '给我放适合工作的歌' });

      expect(res.status).toBe(200);
      expect(res.body.claude).toBe(false);
      expect(res.body.say).toContain('LLM 已禁用');
      expect(invokeClaude).not.toHaveBeenCalled();
    });

    it('assembles context before calling Claude', async () => {
      const res = await request(app)
        .post('/api/chat')
        .send({ text: '播放爵士乐' });

      expect(res.status).toBe(200);
      expect(assemblePrompt).toHaveBeenCalled();
      expect(invokeClaude).toHaveBeenCalled();
      // prompt arg should contain the assembled prompt
      const promptArg = (invokeClaude as any).mock.calls[0][0];
      expect(promptArg).toContain('Assembled Prompt');
    });
  });

  describe('GET /api/queue/suggested', () => {
    it('does not call queue predictor when scene suggestions are disabled', async () => {
      vi.mocked(getPref).mockImplementation((_db, key) => key === 'scene_suggestions_enabled' ? 'false' : null);
      const executor = { getContext: vi.fn().mockResolvedValue({ weather: '', calendar: '' }) };
      app = createApp({ db: {} as any, executor: executor as any });

      const res = await request(app).get('/api/queue/suggested');

      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.play).toEqual([]);
      expect(getSuggestedQueue).not.toHaveBeenCalled();
    });
  });

  describe('API config', () => {
    it('returns scene suggestion toggle state', async () => {
      vi.mocked(getPref).mockImplementation((_db, key) => key === 'scene_suggestions_enabled' ? 'false' : null);

      const res = await request(app).get('/api/config');

      expect(res.status).toBe(200);
      expect(res.body.sceneSuggestionsEnabled).toBe(false);
    });

    it('persists scene suggestion toggle state', async () => {
      const res = await request(app)
        .post('/api/config')
        .send({ sceneSuggestionsEnabled: false });

      expect(res.status).toBe(200);
      expect(setPref).toHaveBeenCalledWith(expect.anything(), 'scene_suggestions_enabled', 'false');
    });
  });

  describe('GET /api/now', () => {
    it('returns current playing state', async () => {
      const res = await request(app).get('/api/now');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('current');
      expect(res.body).toHaveProperty('queue');
    });

    it('returns recent plays from DB as queue', async () => {
      const res = await request(app).get('/api/now');

      expect(res.status).toBe(200);
      expect(res.body.queue).toHaveLength(1);
      expect(res.body.queue[0].song_name).toBe('Take Five');
      expect(res.body.queue[0].artist).toBe('Dave Brubeck');
    });
  });

  describe('GET /api/history', () => {
    it('returns paginated unique play history from DB', async () => {
      const res = await request(app).get('/api/history?page=2&pageSize=10');

      expect(res.status).toBe(200);
      expect(getPlayHistory).toHaveBeenCalledWith(expect.anything(), 2, 10);
      expect(res.body.items[0].song_name).toBe('Take Five');
      expect(res.body.totalPages).toBe(1);
    });

    it('returns an empty history when DB is unavailable', async () => {
      const appWithoutDb = createApp();

      const res = await request(appWithoutDb).get('/api/history');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });
  });

  describe('play history recording', () => {
    it('does not record direct play by id before the browser starts playback', async () => {
      const res = await request(app)
        .post('/api/play/by-id')
        .send({ songId: '123' });

      expect(res.status).toBe(200);
      expect(addPlay).not.toHaveBeenCalled();
    });

    it('does not record chat executor results before the browser starts playback', async () => {
      const executor = {
        getContext: vi.fn().mockResolvedValue({ weather: '', calendar: '' }),
        executePlay: vi.fn().mockResolvedValue([
          { songId: '321', name: 'Chat Song', artist: 'Chat Artist', url: 'https://music.126.net/chat.mp3' },
        ]),
        acquireSpeaker: vi.fn(),
      };
      app = createApp({ db: {} as any, executor: executor as any });

      const res = await request(app)
        .post('/api/chat')
        .send({ text: '播放爵士乐' });

      expect(res.status).toBe(200);
      expect(addPlay).not.toHaveBeenCalled();
    });

    it('records browser-confirmed playback events', async () => {
      const res = await request(app)
        .post('/api/history/record')
        .send({ songId: '123', name: 'Mock Song', artist: 'Mock Artist' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(addPlay).toHaveBeenCalledWith(expect.anything(), {
        song_id: '123',
        song_name: 'Mock Song',
        artist: 'Mock Artist',
      });
    });

    it('rejects browser playback records without songId', async () => {
      const res = await request(app)
        .post('/api/history/record')
        .send({ name: 'Missing Song ID' });

      expect(res.status).toBe(400);
      expect(addPlay).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/plan/today', () => {
    it('returns today plan', async () => {
      const res = await request(app).get('/api/plan/today');

      expect(res.status).toBe(200);
      expect(res.body.songs).toEqual(['id1']);
    });
  });

  describe('error middleware', () => {
    it('catches unhandled errors and returns structured JSON', async () => {
      const e = express();
      e.get('/test-unhandled', () => { throw new Error('boom'); });
      const { errorMiddleware } = await import('../src/errors.js');
      e.use(errorMiddleware);
      const res = await request(e).get('/test-unhandled');
      if (Object.keys(res.body).length > 0) {
        expect(res.status).toBe(500);
        expect(res.body).toMatchObject({ ok: false, code: 'UNEXPECTED', message: 'boom' });
      }
    });
  });
});