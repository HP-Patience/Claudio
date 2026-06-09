import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process'); // silence accidental imports

import { searchSongs, getSongDetail, getSongUrl, getLyric, getRecommendations } from '../src/adapters/netease.js';

describe('netease adapter', () => {
  const API = 'http://localhost:3001';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searchSongs returns parsed song list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        result: {
          songs: [
            { id: 123, name: 'Take Five', artists: [{ name: 'Dave Brubeck' }], album: { name: 'Time Out' } },
            { id: 456, name: 'So What', artists: [{ name: 'Miles Davis' }], album: { name: 'Kind of Blue' } },
          ],
        },
      }), { status: 200 }),
    );

    const results = await searchSongs('jazz', 5);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(123);
    expect(results[0].name).toBe('Take Five');
    expect(results[0].artist).toBe('Dave Brubeck');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search?keywords=jazz&limit=5'),
      expect.any(Object),
    );
  });

  it('searchSongs returns empty array on empty result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { songs: [] } }), { status: 200 }),
    );

    const results = await searchSongs('nonexistent_xyz');
    expect(results).toEqual([]);
  });

  it('getSongDetail returns song by ID', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        songs: [{ id: 2151956989, name: '人上人', ar: [{ name: '法老' }], al: { name: 'Feel' } }],
      }), { status: 200 }),
    );

    const song = await getSongDetail(2151956989);
    expect(song).not.toBeNull();
    expect(song!.name).toBe('人上人');
    expect(song!.artist).toBe('法老');
  });

  it('getSongUrl returns playable URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: [{ url: 'https://music.163.com/song/media/outer/url?id=123.mp3' }],
      }), { status: 200 }),
    );

    const url = await getSongUrl(123);
    expect(url).toBe('https://music.163.com/song/media/outer/url?id=123.mp3');
  });

  it('getSongUrl returns empty string when no url available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );

    const url = await getSongUrl(999999);
    expect(url).toBe('');
  });

  it('getLyric returns lyric text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        lrc: { lyric: '[00:01.00]Hello world\n[00:02.00]Goodbye\n' },
      }), { status: 200 }),
    );

    const lyric = await getLyric(123);
    expect(lyric).toContain('Hello world');
  });

  it('getRecommendations returns parsed song list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: {
          dailySongs: [
            { id: 789, name: 'Autumn Leaves', ar: [{ name: 'Bill Evans' }], al: { name: 'Portrait' } },
          ],
        },
      }), { status: 200 }),
    );

    const results = await getRecommendations();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Autumn Leaves');
    expect(results[0].artist).toBe('Bill Evans');
  });
});
