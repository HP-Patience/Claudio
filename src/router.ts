import express from 'express';
import type { Express, Request, Response } from 'express';
import type Database from 'better-sqlite3';
import { getRecentPlays, getPlan, addMessage, getMessages, getPref, setPref, addFavorite, removeFavorite, isFavorite, getFavorites, addHiddenSong } from './db.js';
import { invokeClaude } from './claude.js';
import { assemblePrompt } from './context.js';
import type { createExecutor } from './executor.js';
import { broadcast } from './ws.js';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const NCM_API_BASE = process.env.NCM_API ?? 'http://localhost:3001';

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
      if (opts.db) addMessage(opts.db, { role: 'user', content: text });
      res.json({ talk: false, claude: false, action: text.trim() });
      return;
    }

    // Save user message to DB
    if (opts.db) addMessage(opts.db, { role: 'user', content: text });

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

    const result = await invokeClaude(fullPrompt, { db: opts.db });

    if (result.usage) {
      broadcast('token_usage', result.usage);
    }

    // Save AI reply to DB
    if (opts.db && result.say) {
      addMessage(opts.db, { role: 'assistant', content: result.say });
    }

    // Execute play actions if executor is available
    let playedItems;
    if (opts.executor && result.play && result.play.length > 0) {
      const queries = result.play.filter((p: any) => typeof p === 'string');
      if (queries.length > 0) {
        try {
          playedItems = await opts.executor.executePlay(queries);
          // Log player state
          if (opts.db && playedItems.length > 0) {
            for (const item of playedItems) {
              addMessage(opts.db, { role: 'assistant', content: `Playing: ${item.name} by ${item.artist}` });
            }
          }
          // Broadcast play event to all WebSocket clients
          broadcast('play', { tracks: playedItems });
        } catch {
          // netease API offline — skip play
        }
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
      console.error('[chat error]', err);
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

  app.get('/api/messages', (_req: Request, res: Response) => {
    if (!opts.db) return res.json({ messages: [] });
    const messages = getMessages(opts.db, 100).reverse();
    res.json({ messages });
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

  // ── API 配置 ──
  app.get('/api/config', (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const apiKey = getPref(opts.db, 'api_key') || '';
    const baseUrl = getPref(opts.db, 'api_base_url') || '';
    res.json({ apiKey, baseUrl });
  });

  app.post('/api/config', (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const { apiKey, baseUrl } = req.body;
    if (apiKey !== undefined && !apiKey.includes('*')) {
      setPref(opts.db, 'api_key', apiKey);
    }
    if (baseUrl !== undefined) {
      setPref(opts.db, 'api_base_url', baseUrl);
    }
    res.json({ ok: true });
  });

  app.post('/api/config/test', async (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const apiKey = req.body.apiKey || getPref(opts.db, 'api_key') || '';
    const baseUrl = req.body.baseUrl || getPref(opts.db, 'api_base_url') || '';
    if (!apiKey) return res.status(400).json({ ok: false, message: 'API Key 不能为空' });
    if (!baseUrl) return res.status(400).json({ ok: false, message: 'Base URL 不能为空' });

    const cleanBase = baseUrl.replace(/\/+$/, '');
    const isAnthropic = cleanBase.includes('anthropic.com');

    try {
      if (isAnthropic) {
        const response = await fetch(`${cleanBase}/v1/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown error');
          return res.status(502).json({ ok: false, message: `API 错误 (${response.status}): ${text.slice(0, 200)}` });
        }
        res.json({ ok: true, message: '主人，我在' });
      } else {
        // OpenAI-compatible (DeepSeek, etc.)
        const body = JSON.stringify({ model: 'deepseek-chat', max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] });
        const u = new URL(`${cleanBase}/v1/chat/completions`);
        const result = await new Promise<{ ok: boolean; message: string }>((resolve) => {
          const req = https.request({
            hostname: u.hostname, port: 443, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
            timeout: 10000,
          }, (r) => {
            let data = '';
            r.on('data', (chunk) => data += chunk);
            r.on('end', () => {
              if (r.statusCode && r.statusCode >= 200 && r.statusCode < 300) {
                resolve({ ok: true, message: '主人，我在' });
              } else {
                resolve({ ok: false, message: `API 错误 (${r.statusCode}): ${data.slice(0, 200)}` });
              }
            });
          });
          req.on('error', (e) => resolve({ ok: false, message: `连接失败: ${e.message}` }));
          req.on('timeout', () => { req.destroy(); resolve({ ok: false, message: '连接超时' }); });
          req.write(body);
          req.end();
        });
        if (result.ok) return res.json(result);
        return res.status(502).json(result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ ok: false, message: `连接失败: ${msg}` });
    }
  });

  app.get('/api/status/ncm', async (_req: Request, res: Response) => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${NCM_API_BASE}/search?keywords=test&limit=1`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        res.json({ online: true });
      } else {
        res.json({ online: false, reason: `HTTP ${r.status}` });
      }
    } catch {
      res.json({ online: false, reason: 'unreachable' });
    }
  });

  // ── Favorites ──

  app.get('/api/favorites', (_req: Request, res: Response) => {
    if (!opts.db) return res.json({ favorites: [] });
    res.json({ favorites: getFavorites(opts.db) });
  });

  app.post('/api/favorites/toggle', (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const { songId, name, artist } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId required' });

    if (isFavorite(opts.db, songId)) {
      removeFavorite(opts.db, songId);
      res.json({ loved: false });
    } else {
      addFavorite(opts.db, songId, name || '', artist || '');
      res.json({ loved: true });
    }
  });

  // ── Hide ──

  app.post('/api/hide', (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const { songId, name, artist } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId required' });

    addHiddenSong(opts.db, songId, name || '', artist || '');
    res.json({ hidden: true });
  });

  return app;
}
