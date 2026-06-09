import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentWeather } from '../src/adapters/weather.js';

describe('weather adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns structured weather data for a city', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        main: { temp: 22.5, feels_like: 21.0 },
        weather: [{ description: '晴', icon: '01d' }],
        name: 'Hangzhou',
      }), { status: 200 }),
    );

    const result = await getCurrentWeather('Hangzhou');

    expect(result).toEqual({
      city: 'Hangzhou',
      temp: 22.5,
      feelsLike: 21.0,
      description: '晴',
      icon: '01d',
    });
  });

  it('fetches with correct URL and API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        main: { temp: 15, feels_like: 14 },
        weather: [{ description: 'cloudy', icon: '02d' }],
        name: 'Beijing',
      }), { status: 200 }),
    );

    await getCurrentWeather('Beijing');

    const url = (fetch as any).mock.calls[0][0];
    expect(url).toContain('openweathermap.org');
    expect(url).toContain('Beijing');
  });

  it('throws on API error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 }),
    );

    await expect(getCurrentWeather('UnknownCity')).rejects.toThrow('Weather API error: 401');
  });
});
