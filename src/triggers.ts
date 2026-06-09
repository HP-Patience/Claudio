import { broadcast } from './ws.js';

interface TriggerRule {
  id: string;
  check: (ctx: TriggerContext) => boolean;
  suggestion: string;
  scene: string;
}

export interface TriggerContext {
  hour: number;
  day: number;
  weather: string;
  calendar: string;
}

const RULES: TriggerRule[] = [
  {
    id: 'rainy_evening',
    check: (c) => c.hour >= 18 && c.hour <= 20 && c.weather.includes('雨'),
    suggestion: '下雨了，来点爵士？',
    scene: 'rainy_evening',
  },
  {
    id: 'morning_commute',
    check: (c) => c.day === 1 && c.hour >= 7 && c.hour <= 9,
    suggestion: '周一早上，提神节奏？',
    scene: 'morning_commute',
  },
  {
    id: 'friday_night',
    check: (c) => c.day === 5 && c.hour >= 18 && c.hour <= 22,
    suggestion: '周五晚上，放松一下？',
    scene: 'friday_night',
  },
  {
    id: 'birthday',
    check: (c) => c.calendar.includes('生日'),
    suggestion: '今天有人生日，来点庆祝歌？',
    scene: 'birthday',
  },
  {
    id: 'late_night',
    check: (c) => c.hour >= 22 || c.hour < 6,
    suggestion: '夜深了，轻柔助眠？',
    scene: 'late_night',
  },
  {
    id: 'weekend_chill',
    check: (c) => (c.day === 0 || c.day === 6) && c.hour >= 10 && c.hour <= 14 && c.weather.includes('晴'),
    suggestion: '好天气，来点轻松的？',
    scene: 'weekend_chill',
  },
];

const cooldowns = new Map<string, number>();

export function checkTriggers(ctx: TriggerContext): void {
  const now = Date.now();
  for (const rule of RULES) {
    if (!rule.check(ctx)) continue;
    const last = cooldowns.get(rule.id) || 0;
    if (now - last < 2 * 3600_000) continue;
    cooldowns.set(rule.id, now);
    broadcast('suggestion', { id: rule.id, text: rule.suggestion, scene: rule.scene });
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

let _lat: number | null = null;
let _lon: number | null = null;

export function cacheCoords(lat: number, lon: number): void {
  _lat = lat;
  _lon = lon;
}

export function getCachedCoords(): { lat: number; lon: number } | null {
  return _lat != null && _lon != null ? { lat: _lat, lon: _lon } : null;
}

export function startTriggerLoop(getContext: () => Promise<TriggerContext>): void {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const ctx = await getContext();
      checkTriggers(ctx);
    } catch { /* ignore */ }
  }, 5 * 60_000);
}

export function stopTriggerLoop(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
