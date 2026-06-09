let API_KEY = process.env.OPENWEATHER_API_KEY ?? '';

export function setWeatherKey(key: string): void {
  if (key) API_KEY = key;
}
const BASE = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  description: string;
  icon: string;
}

export async function getCurrentWeather(city: string): Promise<WeatherData> {
  const url = `${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const data = await res.json();
  return {
    city: data.name,
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
  };
}

export async function getCurrentWeatherByCoords(lat: number, lon: number): Promise<WeatherData> {
  const url = `${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=zh_cn`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  const data = await res.json();
  return {
    city: data.name,
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
  };
}
