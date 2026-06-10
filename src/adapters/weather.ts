let API_KEY = process.env.SENIVERSE_API_KEY ?? '';

export function setWeatherKey(key: string): void {
  if (key) API_KEY = key;
}

export function hasWeatherKey(): boolean {
  return !!API_KEY;
}

const BASE = 'https://api.seniverse.com/v3/weather/now.json';

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
}

async function seniverseFetch(location: string): Promise<WeatherData> {
  if (!API_KEY) throw new Error('Seniverse API key not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `${BASE}?key=${API_KEY}&location=${encodeURIComponent(location)}&language=zh-Hans&unit=c`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Seniverse API error: ${res.status}`);
    const data = await res.json();
    if (data.status_code) throw new Error(`Seniverse API: ${data.status_detail || 'error'}`);
    const r = data.results?.[0];
    if (!r) throw new Error('Seniverse: empty result');
    return {
      city: r.location?.name ?? location,
      temp: Number(r.now?.temperature ?? 0),
      feelsLike: Number(r.now?.feels_like ?? r.now?.temperature ?? 0),
      description: r.now?.text ?? '',
      icon: r.now?.code ? `https://www.seniverse.com/weather/icon/${r.now.code}/64/cloudy.png` : '',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function getCurrentWeather(city: string): Promise<WeatherData> {
  return seniverseFetch(city);
}

export async function getCurrentWeatherByCoords(lat: number, lon: number): Promise<WeatherData> {
  return seniverseFetch(`${lat}:${lon}`);
}
