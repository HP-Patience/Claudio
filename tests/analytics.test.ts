import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db.js';
import { generateReport, getCurrentStatsWindow, isStatsRange } from '../src/analytics.js';

describe('analytics stats ranges', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    initDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('accepts only supported stats ranges', () => {
    expect(isStatsRange('week')).toBe(true);
    expect(isStatsRange('month')).toBe(true);
    expect(isStatsRange('quarter')).toBe(true);
    expect(isStatsRange('year')).toBe(true);
    expect(isStatsRange('day')).toBe(false);
    expect(isStatsRange('all')).toBe(false);
    expect(isStatsRange('')).toBe(false);
    expect(isStatsRange(undefined)).toBe(false);
  });

  it('computes current week window from Monday to next Monday', () => {
    expect(getCurrentStatsWindow('week', new Date(2026, 6, 1))).toMatchObject({
      range: 'week',
      period: '2026-W27',
      startDate: '2026-06-29',
      endDate: '2026-07-06',
      label: '本周',
    });
  });

  it('computes current month, quarter, and year windows', () => {
    expect(getCurrentStatsWindow('month', new Date(2026, 6, 1))).toMatchObject({
      range: 'month',
      period: '2026-07',
      startDate: '2026-07-01',
      endDate: '2026-08-01',
      label: '本月',
    });
    expect(getCurrentStatsWindow('quarter', new Date(2026, 6, 1))).toMatchObject({
      range: 'quarter',
      period: '2026-Q3',
      startDate: '2026-07-01',
      endDate: '2026-10-01',
      label: '本季度',
    });
    expect(getCurrentStatsWindow('year', new Date(2026, 6, 1))).toMatchObject({
      range: 'year',
      period: '2026',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      label: '本年',
    });
  });

  it('aggregates only plays inside current week bounds', async () => {
    db.prepare('INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)')
      .run('outside-before', 'Outside Before', 'Artist A', '2026-06-28 15:59:59');
    db.prepare('INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)')
      .run('inside-start', 'Inside Start', 'Artist B', '2026-06-28 16:00:00');
    db.prepare('INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)')
      .run('inside-end', 'Inside End', 'Artist C', '2026-07-05 15:59:59');
    db.prepare('INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)')
      .run('outside-after', 'Outside After', 'Artist D', '2026-07-05 16:00:00');

    const report = await generateReport(db, '2026-W27', 'week');

    expect(report.range).toBe('week');
    expect(report.period).toBe('2026-W27');
    expect(report.stat.totalPlays).toBe(2);
  });

  it('includes SQLite UTC timestamps that fall inside the local quarter window', async () => {
    db.prepare('INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)')
      .run('local-q3', 'Local Q3 Song', 'Artist Q', '2026-06-30 16:22:21');

    const report = await generateReport(db, '2026-Q3', 'quarter');

    expect(report.range).toBe('quarter');
    expect(report.period).toBe('2026-Q3');
    expect(report.stat.totalPlays).toBe(1);
  });

  it('uses range labels in empty report fallbacks', async () => {
    await expect(generateReport(db, '2026-W27', 'week')).resolves.toMatchObject({
      period: '2026-W27',
      range: 'week',
      insight: expect.stringContaining('本周暂无播放数据'),
    });
    await expect(generateReport(db, '2026-07', 'month')).resolves.toMatchObject({
      period: '2026-07',
      range: 'month',
      insight: expect.stringContaining('本月暂无播放数据'),
    });
    await expect(generateReport(db, '2026-Q3', 'quarter')).resolves.toMatchObject({
      period: '2026-Q3',
      range: 'quarter',
      insight: expect.stringContaining('本季度暂无播放数据'),
    });
    await expect(generateReport(db, '2026', 'year')).resolves.toMatchObject({
      period: '2026',
      range: 'year',
      insight: expect.stringContaining('本年暂无播放数据'),
    });
  });
});
