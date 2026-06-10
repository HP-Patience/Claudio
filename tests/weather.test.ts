import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentWeather, setWeatherKey } from '../src/adapters/weather.js';

describe('weather adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setWeatherKey('test_key');
  });

  it('returns structured weather data for a city', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          location: { name: 'Hangzhou' },
          now: { text: '晴', code: '0', temperature: '22.5', feels_like: '21.0' },
          last_update: '2025-06-10T12:00:00+08:00',
        }],
      }), { status: 200 }),
    );

    const result = await getCurrentWeather('Hangzhou');

    expect(result).toEqual({
      city: 'Hangzhou',
      temp: 22.5,
      feelsLike: 21.0,
      description: '晴',
      icon: expect.stringContaining('seniverse.com/weather/icon/0'),
    });
  });

  it('fetches with correct URL and API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          location: { name: 'Beijing' },
          now: { text: 'cloudy', code: '1', temperature: '15' },
        }],
      }), { status: 200 }),
    );

    await getCurrentWeather('Beijing');

    const url = (fetch as any).mock.calls[0][0];
    expect(url).toContain('seniverse.com');
    expect(url).toContain('Beijing');
    expect(url).toContain('language=zh-Hans');
  });

  it('throws on API error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(getCurrentWeather('UnknownCity')).rejects.toThrow('Seniverse API error: 401');
  });

  it('throws on API error in body', async () => {
    // Simulate a 200 response with API error in body (edge case)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [],
      }), { status: 200 }),
    );

    await expect(getCurrentWeather('Hangzhou')).rejects.toThrow('Seniverse: empty result');
  });
});
