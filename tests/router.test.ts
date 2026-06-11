import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../src/router.js';
import request from 'supertest';

vi.mock('../src/db.js', () => ({
  initDb: vi.fn(),
  getMessages: vi.fn().mockReturnValue([
    { role: 'user', content: 'previous msg', created_at: '2026-06-09 07:00' },
  ]),
  getPlan: vi.fn().mockReturnValue({ songs: ['id1'], theme: 'morning' }),
  getRecentPlays: vi.fn().mockReturnValue([
    { song_id: '789', song_name: 'Take Five', artist: 'Dave Brubeck', played_at: '2026-06-09 08:00' },
  ]),
  addMessage: vi.fn(),
  getPref: vi.fn().mockReturnValue(null),
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

vi.mock('../src/adapters/netease.js', () => ({
  getNcmCookie: vi.fn().mockReturnValue('mock-cookie'),
  getPlaylistDetail: vi.fn(),
  addTracksToPlaylist: vi.fn(),
  getUserPlaylists: vi.fn().mockResolvedValue([]),
  createPlaylist: vi.fn(),
  removeTracksFromPlaylist: vi.fn(),
}));

import { getRecentPlays } from '../src/db.js';
import { invokeClaude } from '../src/claude.js';
import { assemblePrompt } from '../src/context.js';

describe('router', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('GET /api/plan/today', () => {
    it('returns today plan', async () => {
      const res = await request(app).get('/api/plan/today');

      expect(res.status).toBe(200);
      expect(res.body.songs).toEqual(['id1']);
    });
  });
});