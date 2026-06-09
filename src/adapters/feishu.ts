let APP_ID = process.env.FEISHU_APP_ID ?? '';
let APP_SECRET = process.env.FEISHU_APP_SECRET ?? '';

export function setFeishuConfig(appId: string, appSecret: string): void {
  if (appId) APP_ID = appId;
  if (appSecret) APP_SECRET = appSecret;
}
const AUTH_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const CALENDAR_URL = 'https://open.feishu.cn/open-apis/calendar/v4/events';

export interface FeishuEvent {
  eventId: string;
  summary: string;
  startTime: number;
  endTime: number;
  description: string;
}

async function getToken(): Promise<string> {
  const res = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Feishu auth failed: ${data.msg}`);
  return data.tenant_access_token;
}

async function fetchEvents(startTime: number, endTime: number): Promise<FeishuEvent[]> {
  const token = await getToken();
  const params = new URLSearchParams({
    start_time: String(Math.floor(startTime / 1000)),
    end_time: String(Math.floor(endTime / 1000)),
  });
  const res = await fetch(`${CALENDAR_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const items = data?.data?.items ?? [];
  return items.map((e: any) => ({
    eventId: e.event_id,
    summary: e.summary ?? '',
    startTime: Number(e.start_time?.timestamp ?? 0) * 1000,
    endTime: Number(e.end_time?.timestamp ?? 0) * 1000,
    description: e.description ?? '',
  }));
}

export async function getTodayEvents(): Promise<FeishuEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return fetchEvents(start.getTime(), end.getTime());
}

export async function getUpcomingEvents(hours = 2): Promise<FeishuEvent[]> {
  const now = Date.now();
  return fetchEvents(now, now + hours * 3600_000);
}
