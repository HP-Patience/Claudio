import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExecutor } from '../src/executor.js';

// Mock the service adapters used by executor
vi.mock('../src/adapters/netease.js', () => ({
  searchSongs: vi.fn().mockResolvedValue([
    { id: 2151956989, name: '人上人', artist: '法老', album: '' },
  ]),
  getSongUrl: vi.fn().mockResolvedValue('https://music.163.com/xxx.mp3'),
}));

vi.mock('../src/adapters/weather.js', () => ({
  getCurrentWeather: vi.fn().mockResolvedValue({
    city: 'Hangzhou', temp: 22, feelsLike: 20, description: '晴', icon: '01d',
  }),
}));

vi.mock('../src/adapters/feishu.js', () => ({
  getTodayEvents: vi.fn().mockResolvedValue([
    { eventId: 'ev1', summary: 'Team Standup', startTime: Date.now() + 3600000, endTime: Date.now() + 7200000, description: '' },
  ]),
}));

import { searchSongs, getSongUrl } from '../src/adapters/netease.js';
import { getCurrentWeather } from '../src/adapters/weather.js';
import { getTodayEvents } from '../src/adapters/feishu.js';

describe('executor', () => {
  let exec: ReturnType<typeof createExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    exec = createExecutor();
  });

  it('getPlayState returns default state', () => {
    const state = exec.getPlayState();
    expect(state).toHaveProperty('isPlaying', false);
    expect(state).toHaveProperty('queue');
    expect(state.queue).toEqual([]);
  });

  it('executes string search queries: search + get URL + update state', async () => {
    const result = await exec.executePlay(['法老 人上人']);

    expect(searchSongs).toHaveBeenCalledWith('法老 人上人', 1);
    expect(getSongUrl).toHaveBeenCalledWith(2151956989);
    expect(result[0].name).toBe('人上人');
    expect(result[0].artist).toBe('法老');
    expect(result[0].url).toContain('music.163.com');

    const state = exec.getPlayState();
    expect(state.isPlaying).toBe(true);
    expect(state.queue).toHaveLength(1);
  });

  it('executes action object format', async () => {
    const result = await exec.executePlay([{
      service: 'music',
      action: 'search_and_play',
      params: { query: '法老 人上人', type: 'track' },
    }]);

    expect(searchSongs).toHaveBeenCalledWith('法老 人上人', 1);
    expect(result[0].name).toBe('人上人');
  });

  it('handles empty play gracefully (TTS only)', async () => {
    const result = await exec.executePlay([]);
    expect(result).toEqual([]);
  });

  it('acquireSpeaker and releaseSpeaker toggle speaking state', () => {
    exec.acquireSpeaker();
    expect(exec.getPlayState().isSpeaking).toBe(true);

    exec.releaseSpeaker();
    expect(exec.getPlayState().isSpeaking).toBe(false);
  });

  it('getContext fetches weather and calendar', async () => {
    const ctx = await exec.getContext('Hangzhou');

    expect(getCurrentWeather).toHaveBeenCalledWith('Hangzhou');
    expect(getTodayEvents).toHaveBeenCalled();
    expect(ctx.weather).toContain('22°C');
    expect(ctx.calendar).toContain('Team Standup');
  });

  it('getContext handles API failures gracefully', async () => {
    vi.mocked(getCurrentWeather).mockRejectedValueOnce(new Error('API down'));
    vi.mocked(getTodayEvents).mockRejectedValueOnce(new Error('Feishu down'));

    const ctx = await exec.getContext('Hangzhou');

    expect(ctx.weather).toBe('');
    expect(ctx.calendar).toBe('');
  });
});
