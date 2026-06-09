import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTodayEvents, getUpcomingEvents } from '../src/adapters/feishu.js';

describe('feishu adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  it('getTodayEvents returns calendar events for today', async () => {
    // mock: get tenant_access_token
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, tenant_access_token: 'token-123' }), { status: 200 }),
      )
      // mock: get events
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          code: 0,
          data: {
            items: [
              {
                event_id: 'ev1',
                summary: 'Team Standup',
                start_time: { timestamp: String(Math.floor(todayStart.getTime() / 1000) + 36000) },
                end_time: { timestamp: String(Math.floor(todayStart.getTime() / 1000) + 37200) },
                description: 'Daily sync',
              },
              {
                event_id: 'ev2',
                summary: 'Lunch',
                start_time: { timestamp: String(Math.floor(todayStart.getTime() / 1000) + 43200) },
                end_time: { timestamp: String(Math.floor(todayStart.getTime() / 1000) + 46800) },
              },
            ],
          },
        }), { status: 200 }),
      );

    const events = await getTodayEvents();

    expect(events).toHaveLength(2);
    expect(events[0].summary).toBe('Team Standup');
    expect(events[0].eventId).toBe('ev1');
    expect(events[1].summary).toBe('Lunch');
  });

  it('getTodayEvents returns empty array when no events', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, tenant_access_token: 'token' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { items: [] } }), { status: 200 }),
      );

    const events = await getTodayEvents();
    expect(events).toEqual([]);
  });

  it('getUpcomingEvents accepts custom hours parameter', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, tenant_access_token: 'token' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0, data: { items: [] } }), { status: 200 }),
      );

    await getUpcomingEvents(4);

    // verify the second fetch URL contains time range
    const callUrl = (fetch as any).mock.calls[1][0];
    expect(callUrl).toContain('open.feishu.cn/open-apis/calendar/v4/events');
  });

  it('throws on auth failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 999, msg: 'Invalid app secret' }), { status: 200 }),
    );

    await expect(getTodayEvents()).rejects.toThrow('Feishu auth failed');
  });
});
