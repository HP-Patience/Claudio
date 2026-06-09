import express from 'express';
import type { Express, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getRecentPlays, getPlan, addMessage, getMessages } from './db.js';
import { invokeClaude } from './claude.js';
import { assemblePrompt } from './context.js';
import type { createExecutor } from './executor.js';
import { broadcast } from './ws.js';
import fs from 'node:fs';
import path from 'node:path';

const SIMPLE_COMMANDS = new Set([
  '下一首', '暂停', '继续', '上一首', '音量加', '音量减',
  'next', 'pause', 'resume', 'prev', 'volume_up', 'volume_down',
  'stop', 'play', 'start',
]);

function classifyIntent(text: string): 'simple' | 'claude' {
  const trimmed = text.trim().toLowerCase();
  for (const cmd of SIMPLE_COMMANDS) {
    if (cmd === trimmed) return 'simple';
  }
  return 'claude';
}

function loadDJPrompt(): string {
  try {
    return fs.readFileSync(path.resolve('prompts/dj-persona.md'), 'utf-8');
  } catch {
    return '';
  }
}

interface RouterOptions {
  db?: Database.Database;
  executor?: ReturnType<typeof createExecutor>;
}

export function createApp(opts: RouterOptions = {}): Express {
  const app = express();
  app.use(express.json());

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
    const { text } = req.body;

    if (classifyIntent(text) === 'simple') {
      res.json({ talk: false, claude: false, action: text.trim() });
      return;
    }

    // Fetch real context if executor is available
    let weather = '';
    let calendar = '';
    if (opts.executor) {
      try {
        const ctx = await opts.executor.getContext();
        weather = ctx.weather;
        calendar = ctx.calendar;
      } catch {
        // fallback to empty
      }
    }

    const history = opts.db ? getMessages(opts.db, 10).reverse() : [];
    const basePrompt = assemblePrompt({
      userCorpusDir: process.env.USER_CORPUS_DIR ?? 'user',
      weather,
      calendar,
      time: new Date().toLocaleString('zh-CN'),
      recentHistory: history,
    });
    const djPersona = loadDJPrompt();

    const fullPrompt = `${djPersona}

${basePrompt}

=== User Message ===
${text}

IMPORTANT: Output ONLY valid JSON, no markdown, no extra text.
"play" must be an array of search query strings, e.g. ["法老 人上人", "Bill Evans Waltz for Debby"].
These will be used to search NetEase Cloud Music. If no song fits, "play" must be empty.
{
  "say": "DJ播报文案（中文，简短自然，1-2句话）",
  "play": [],
  "reason": "选歌原因",
  "segue": "歌曲转场词（没有则填空字符串）"
}`;

    const result = await invokeClaude(fullPrompt);

    // Execute play actions if executor is available
    let playedItems;
    if (opts.executor && result.play && result.play.length > 0) {
      const queries = result.play.filter((p: any) => typeof p === 'string');
      if (queries.length > 0) {
        playedItems = await opts.executor.executePlay(queries);
        // Log player state
        if (opts.db && playedItems.length > 0) {
          for (const item of playedItems) {
            addMessage(opts.db, { role: 'assistant', content: `Playing: ${item.name} by ${item.artist}` });
          }
        }
        // Broadcast play event to all WebSocket clients
        broadcast('play', { tracks: playedItems });
      }
    }

    // Handle TTS for the say message
    if (opts.executor && result.say) {
      opts.executor.acquireSpeaker();
      broadcast('say', { text: result.say });
    }

    res.json({ ...result, claude: true, played: playedItems ?? [] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误';
      res.status(500).json({
        say: `抱歉，出错了: ${msg}`,
        play: [],
        reason: '',
        segue: '',
        claude: false,
        error: true,
      });
    }
  });

  app.get('/api/now', (_req: Request, res: Response) => {
    const queue = opts.db ? getRecentPlays(opts.db, 20) : [];
    res.json({ current: queue[0] ?? null, queue });
  });

  app.get('/api/plan/today', (_req: Request, res: Response) => {
    const plan = opts.db
      ? getPlan(opts.db, new Date().toISOString().slice(0, 10))
      : null;
    res.json(plan ?? { songs: [], theme: '' });
  });

  return app;
}
