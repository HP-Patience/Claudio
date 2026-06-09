import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb, addMessage, getMessages, addPlay, getRecentPlays, setPlan, getPlan, setPref, getPref, cleanup } from '../src/db.js';
import fs from 'node:fs';

describe('db', () => {
  const testPath = 'tests/fixtures/test.db';
  let db: Database.Database;

  beforeEach(() => {
    fs.mkdirSync('tests/fixtures', { recursive: true });
    db = new Database(testPath);
    initDb(db);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testPath)) {
      fs.unlinkSync(testPath);
    }
  });

  it('init creates messages, plays, plan, prefs tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const names = tables.map((t) => t.name);
    expect(names).toContain('messages');
    expect(names).toContain('plays');
    expect(names).toContain('plan');
    expect(names).toContain('prefs');
  });

  it('addMessage inserts and getMessages returns messages ordered by time desc', () => {
    addMessage(db, { role: 'user', content: 'hello' });
    addMessage(db, { role: 'assistant', content: 'hi there' });

    const msgs = getMessages(db, 10);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('assistant');
    expect(msgs[0].content).toBe('hi there');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('hello');
  });

  it('addPlay inserts and getRecentPlays returns plays ordered by time desc', () => {
    addPlay(db, { song_id: '123', song_name: 'Test Song', artist: 'Test Artist' });
    addPlay(db, { song_id: '456', song_name: 'Another', artist: 'Artist2' });

    const plays = getRecentPlays(db, 10);
    expect(plays).toHaveLength(2);
    expect(plays[0].song_id).toBe('456');
    expect(plays[1].song_id).toBe('123');
  });

  it('setPlan and getPlan store and retrieve daily plan', () => {
    const planData = { songs: ['id1', 'id2'], theme: 'morning' };
    setPlan(db, '2026-06-09', planData);

    const result = getPlan(db, '2026-06-09');
    expect(result).not.toBeNull();
    expect(result!.songs).toEqual(['id1', 'id2']);
    expect(result!.theme).toBe('morning');
  });

  it('getPlan returns null for missing date', () => {
    const result = getPlan(db, '2099-01-01');
    expect(result).toBeNull();
  });

  it('setPref and getPref store and retrieve key-value preferences', () => {
    setPref(db, 'volume', '50');
    setPref(db, 'theme', 'dark');

    expect(getPref(db, 'volume')).toBe('50');
    expect(getPref(db, 'theme')).toBe('dark');
    expect(getPref(db, 'nonexistent')).toBeNull();
  });

  it('cleanup removes records older than N days', () => {
    // Insert old message manually
    db.prepare(
      "INSERT INTO messages (role, content, created_at) VALUES ('user', 'old', datetime('now', '-31 days'))",
    ).run();
    addMessage(db, { role: 'user', content: 'recent' });

    cleanup(db, 30);

    const msgs = getMessages(db, 100);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('recent');
  });
});
