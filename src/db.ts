import Database from 'better-sqlite3';

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      song_name TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      played_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      plan_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prefs (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);
}

export interface Message {
  role: string;
  content: string;
}

export function addMessage(db: Database.Database, msg: Message): void {
  db.prepare('INSERT INTO messages (role, content) VALUES (?, ?)').run(
    msg.role,
    msg.content,
  );
}

export function getMessages(db: Database.Database, limit: number) {
  return db
    .prepare('SELECT role, content, created_at FROM messages ORDER BY id DESC LIMIT ?')
    .all(limit) as { role: string; content: string; created_at: string }[];
}

export interface Play {
  song_id: string;
  song_name: string;
  artist: string;
}

export function addPlay(db: Database.Database, play: Play): void {
  db.prepare('INSERT INTO plays (song_id, song_name, artist) VALUES (?, ?, ?)').run(
    play.song_id,
    play.song_name,
    play.artist,
  );
}

export function getRecentPlays(db: Database.Database, limit: number) {
  return db
    .prepare('SELECT song_id, song_name, artist, played_at FROM plays ORDER BY id DESC LIMIT ?')
    .all(limit) as { song_id: string; song_name: string; artist: string; played_at: string }[];
}

export function setPlan(db: Database.Database, date: string, plan: unknown): void {
  db.prepare(
    'INSERT INTO plan (date, plan_json) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET plan_json = excluded.plan_json',
  ).run(date, JSON.stringify(plan));
}

export function getPlan(db: Database.Database, date: string): unknown | null {
  const row = db.prepare('SELECT plan_json FROM plan WHERE date = ?').get(date) as
    | { plan_json: string }
    | undefined;
  return row ? JSON.parse(row.plan_json) : null;
}

export function setPref(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  );
}

export function getPref(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM prefs WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : null;
}

export function cleanup(db: Database.Database, keepDays: number): void {
  db.prepare(
    "DELETE FROM messages WHERE created_at < datetime('now', '-' || ? || ' days')",
  ).run(keepDays);
  db.prepare(
    "DELETE FROM plays WHERE played_at < datetime('now', '-' || ? || ' days')",
  ).run(keepDays);
}
