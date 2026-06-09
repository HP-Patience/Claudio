import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { addSkip, getRecentSkips } from './db.js';
import { invokeClaude } from './claude.js';

const MOOD_RULES_PATH = path.resolve('user/mood-rules.md');

export async function handleSkip(opts: {
  db: Database.Database;
  songId: string;
  songName: string;
  artist: string;
  scene: string;
  sessionId: string;
}): Promise<{ corrected: boolean; say?: string; play?: string[] }> {
  addSkip(opts.db, {
    song_id: opts.songId,
    song_name: opts.songName,
    artist: opts.artist,
    scene: opts.scene,
    session_id: opts.sessionId,
  });

  const recent = getRecentSkips(opts.db, opts.sessionId, 5);
  if (recent.length < 3) return { corrected: false };

  const sameScene = recent.filter(s => s.scene === opts.scene);
  if (sameScene.length < 3) return { corrected: false };

  // Append auto-rule to mood-rules.md
  const today = new Date().toISOString().slice(0, 10);
  const rule = `\n## auto-rule ${today}\n连续跳过 ${opts.scene} 场景歌曲 → 降低该场景推荐权重 80%\n`;
  try {
    fs.appendFileSync(MOOD_RULES_PATH, rule, 'utf-8');
  } catch { /* file may not exist */ }

  // Generate corrected recommendation
  const prompt = `You are Claudio. The user has skipped 3+ songs in the "${opts.scene}" scene. The previous direction was wrong. Suggest a completely different direction.

Output ONLY valid JSON:
{
  "say": "纠错文案（中文，1句，承认方向错了并推荐新的）",
  "play": ["新搜索词1", "新搜索词2"]
}`;

  try {
    const result = await invokeClaude(prompt, { db: opts.db, timeout: 30000 });
    return { corrected: true, say: result.say, play: result.play };
  } catch {
    return { corrected: false };
  }
}
