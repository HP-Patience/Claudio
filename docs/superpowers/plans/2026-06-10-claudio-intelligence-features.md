# Claudio AI 智能电台 — 五大智能功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现预测队列(A)、情绪过渡(B)、跳过纠偏(C)、场景触发(D)、品味报告(E) 五大智能功能，按 P0→P4 顺序。

**Architecture:** 每个模块一个独立 .ts 文件（predictor/feedback/triggers/analytics），通过 router.ts 挂载 API 端点，前端通过 HTTP + WebSocket 对接。Claude 保持唯一决策者角色，新模块只做数据采集和触发信号。

**Tech Stack:** TypeScript (Node.js), Express, better-sqlite3, vanilla JS frontend, WebSocket (ws)

---

## 文件结构总览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/predictor.ts` | 新建 | 场景识别 → Claude 推荐队列 |
| `src/feedback.ts` | 新建 | skip 计数 + 纠偏触发 |
| `src/triggers.ts` | 新建 | 环境检测 + 场景建议 |
| `src/analytics.ts` | 新建 | 播放统计 + Claude 洞察 |
| `src/claude.ts` | 修改 | ClaudeOutput 加 mood/arc 字段 |
| `src/db.ts` | 修改 | 新增 skips / play_stats 表 + CRUD |
| `src/router.ts` | 修改 | 新增 6 个端点，修改 /api/chat 和 /api/hide |
| `src/server.ts` | 修改 | 启动 triggers 定时器 |
| `frontend/app.js` | 修改 | 推荐队列加载、arc 展示、correction/suggestion 事件、stats tab |
| `frontend/index.html` | 修改 | 铃铛按钮、STATS tab、toast 容器、arc 指示器 |
| `frontend/style.css` | 修改 | toast、铃铛、arc 条、报告卡片样式 |

---

### Task 1: 模块 A — 场景识别与推荐生成 (predictor.ts)

**Files:**
- Create: `src/predictor.ts`
- Modify: `src/router.ts`
- Modify: `frontend/app.js`

- [ ] **Step 1: 创建 src/predictor.ts**

```typescript
import { assemblePrompt } from './context.js';
import { invokeClaude } from './claude.js';
import type Database from 'better-sqlite3';
import { getMessages, getPref } from './db.js';

export interface SceneInfo {
  scene: string;
  reason: string;
}

export function detectScene(opts: {
  weather: string;
  calendar: string;
}): SceneInfo {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const isWeekend = day === 0 || day === 6;
  const weatherLow = opts.weather.toLowerCase();
  const calLow = opts.calendar.toLowerCase();

  if (calLow.includes('生日')) {
    return { scene: 'birthday', reason: '日历中有生日事件' };
  }
  if (weatherLow.includes('雨') && hour >= 18 && hour <= 22) {
    return { scene: 'rainy_evening', reason: '傍晚下雨' };
  }
  if (hour >= 22 || hour < 6) {
    return { scene: 'late_night', reason: '深夜时段' };
  }
  if (day === 1 && hour >= 7 && hour <= 9) {
    return { scene: 'morning_commute', reason: '周一早晨' };
  }
  if (day === 5 && hour >= 18 && hour <= 22) {
    return { scene: 'friday_night', reason: '周五晚上' };
  }
  if (isWeekend && hour >= 10 && hour <= 14 && weatherLow.includes('晴')) {
    return { scene: 'weekend_chill', reason: '周末晴天' };
  }
  if (hour >= 7 && hour <= 9) {
    return { scene: 'morning_commute', reason: '早晨通勤' };
  }
  if (hour >= 18 && hour <= 20) {
    return { scene: 'evening_unwind', reason: '傍晚放松' };
  }

  return { scene: 'casual', reason: '日常时段' };
}

export async function getSuggestedQueue(opts: {
  db: Database.Database;
  weather: string;
  calendar: string;
}): Promise<{ scene: SceneInfo; say: string; play: string[]; reason: string }> {
  const scene = detectScene({ weather: opts.weather, calendar: opts.calendar });
  const history = getMessages(opts.db, 10).reverse();
  const userCorpusDir = getPref(opts.db, 'user_corpus_dir') ?? process.env.USER_CORPUS_DIR ?? 'user';

  const basePrompt = assemblePrompt({
    userCorpusDir,
    weather: opts.weather,
    calendar: opts.calendar,
    time: new Date().toLocaleString('zh-CN'),
    recentHistory: history,
  });

  const prompt = `You are Claudio, a personal AI radio DJ.

${basePrompt}

=== Scene Context ===
Scene: ${scene.scene}
Why: ${scene.reason}
User hasn't typed anything — they just opened the app. Suggest a queue that fits this moment.

IMPORTANT: Output ONLY valid JSON, no markdown.
{
  "say": "DJ开场白（中文，1句，呼应场景）",
  "play": ["搜索词1", "搜索词2", ...],  // 5-8个
  "reason": "推荐理由（1句话）"
}`;

  const result = await invokeClaude(prompt, { db: opts.db, timeout: 60000 });
  return {
    scene,
    say: result.say,
    play: result.play,
    reason: result.reason,
  };
}
```

- [ ] **Step 2: 在 router.ts 添加 GET /api/queue/suggested**

在 `createApp` 函数内，`GET /api/queue` 路由之后添加：

```typescript
  app.get('/api/queue/suggested', async (req: Request, res: Response) => {
    if (!opts.db || !opts.executor) {
      return res.status(503).json({ error: 'unavailable' });
    }
    try {
      const { lat, lon } = req.query;
      const ctx = await opts.executor.getContext(
        (lat != null && lon != null) ? { lat: Number(lat), lon: Number(lon) } : undefined
      );
      const suggestion = await getSuggestedQueue({
        db: opts.db,
        weather: ctx.weather,
        calendar: ctx.calendar,
      });
      res.json(suggestion);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(502).json({ error: msg });
    }
  });
```

并在文件顶部 import 中添加：

```typescript
import { getSuggestedQueue } from './predictor.js';
```

- [ ] **Step 3: 前端 init() 时请求推荐队列**

在 `frontend/app.js` 的 `init()` 函数中，`connectWs()` 之前添加：

```javascript
  // fetch suggested queue on load
  if (userCoords) {
    try {
      const params = new URLSearchParams({ lat: String(userCoords.lat), lon: String(userCoords.lon) });
      const r = await fetch('/api/queue/suggested?' + params);
      const data = await r.json();
      if (data.play && data.play.length > 0) {
        // show greeting in chat
        addChatMessage(data.say, 'ai');
        // set as queue without auto-playing
        state.queue = data.play.map(q => ({ songId: '', name: q, artist: '', url: '' }));
        setQueue(state.queue);
        state._currentScene = data.scene.scene;
        addChatMessage(`📋 场景推荐 (${data.scene.scene}): ${data.reason}`, 'system');
      }
    } catch { /* ignore */ }
  }
```

- [ ] **Step 4: 验证**

启动服务 `tsx src/server.ts`，打开浏览器。首次加载应在 CHAT 面板看到场景推荐消息，QUEUE 面板显示推荐队列列表。

- [ ] **Step 5: Commit**

```bash
git add src/predictor.ts src/router.ts frontend/app.js
git commit -m "feat: predictive scene-based queue suggestions (A)"
```

---

### Task 2: 模块 B — 情绪感知与渐进过渡

**Files:**
- Modify: `src/claude.ts`
- Modify: `src/router.ts`
- Modify: `frontend/app.js`
- Modify: `frontend/style.css`

- [ ] **Step 1: 扩展 ClaudeOutput 接口**

在 `src/claude.ts` 中修改 `ClaudeOutput` 接口：

```typescript
export interface ClaudeOutput {
  say: string;
  play: string[];
  reason: string;
  segue: string;
  error?: boolean;
  raw?: string;
  mood?: { detected: string; target: string };
  arc?: { start: string; end: string; steps: number };
}
```

- [ ] **Step 2: router.ts 添加情绪检测 + prompt 注入**

在 `createApp` 函数内，`/api/chat` handler 中，`fullPrompt` 组装之后、调用 `invokeClaude` 之前插入：

```typescript
    // Mood detection
    const moodKeywords: Record<string, string> = {
      '心情不好': 'low', '难过': 'low', '伤心': 'low', '郁闷': 'low', '低落': 'low',
      '累了': 'tired', '困': 'tired', '疲惫': 'tired',
      '焦虑': 'anxious', '紧张': 'anxious', '烦': 'anxious',
      '开心': 'happy', '高兴': 'happy', '兴奋': 'excited',
    };
    let moodDetected = '';
    for (const [kw, mood] of Object.entries(moodKeywords)) {
      if (text.includes(kw)) { moodDetected = mood; break; }
    }
    const moodGuidance = moodDetected
      ? `\n=== Mood Guidance ===\nUser mood seems: ${moodDetected}\nStrategy: validate first (1 slow/mid song), then gradually warm up. Never jump to extreme opposite.\nOutput "mood" and "arc" fields in your JSON.`
      : '';
```

更新 `fullPrompt` 组装，在 User Message 之前注入 `moodGuidance`：

```typescript
    const fullPrompt = `${djPersona}

${basePrompt}
${moodGuidance}

=== User Message ===
${text}

IMPORTANT: Output ONLY valid JSON, no markdown, no extra text.
"play" must be an array of search query strings, e.g. ["法老 人上人", "Bill Evans Waltz for Debby"].
These will be used to search NetEase Cloud Music. If no song fits, "play" must be empty.
{
  "say": "DJ播报文案（中文，简短自然，1-2句话）",
  "play": [],
  "reason": "选歌原因",
  "segue": "歌曲转场词（没有则填空字符串）",
  "mood": { "detected": "识别的情绪", "target": "目标情绪" },
  "arc": { "start": "slow|mid|high", "end": "slow|mid|high", "steps": 3 }
}`;
```

- [ ] **Step 3: 前端展示 arc 进度条**

在 `frontend/app.js` 的 `playTrack` 函数中，播放新 track 时更新 arc 显示。在 `progress-container` 下方添加 arc 指示器。先在 `dom` 对象中添加引用：

```javascript
  arcIndicator: $('#arc-indicator'),
```

在 `playTrack` 函数末尾添加：

```javascript
  // update arc indicator
  if (dom.arcIndicator) {
    const trackIdx = state.queue.findIndex(t => t.songId === item.songId);
    const totalSteps = state._arcSteps || 0;
    if (totalSteps > 1 && trackIdx >= 0) {
      dom.arcIndicator.textContent = `情绪过渡 ${trackIdx + 1}/${Math.min(totalSteps, state.queue.length)}`;
      dom.arcIndicator.style.display = '';
    } else {
      dom.arcIndicator.style.display = 'none';
    }
  }
```

在 WebSocket `play` 事件处理中保存 arc 信息：

```javascript
        case 'play':
          if (msg.payload?.tracks) {
            setQueue(msg.payload.tracks);
            playTrack(msg.payload.tracks[0]);
            if (msg.payload.arc) {
              state._arcSteps = msg.payload.arc.steps;
            }
          }
          break;
```

- [ ] **Step 4: 后端广播 arc 数据**

在 router.ts 的 `/api/chat` 中，broadcast play 时带上 arc：

```typescript
          broadcast('play', { tracks: playedItems, arc: result.arc });
```

- [ ] **Step 5: arc 指示器 CSS**

在 `frontend/style.css` 的 progress-container 样式后添加：

```css
.arc-indicator {
  text-align: center;
  font-size: 10px;
  color: var(--accent);
  font-family: var(--font-mono);
  letter-spacing: 0.06em;
  margin-top: 6px;
  opacity: 0.7;
}
```

- [ ] **Step 6: HTML 添加 arc 元素**

在 `index.html` 的 `player-bottom` 中，time-labels 之后添加：

```html
          <div class="arc-indicator" id="arc-indicator" style="display:none"></div>
```

- [ ] **Step 7: 验证**

启动服务，发送"心情不好，来点歌"。确认：chat 响应包含 mood/arc 字段，前端显示情绪过渡进度。

- [ ] **Step 8: Commit**

```bash
git add src/claude.ts src/router.ts frontend/app.js frontend/index.html frontend/style.css
git commit -m "feat: mood-aware gradual transition with arc indicator (B)"
```

---

### Task 3: 模块 C — 连续跳过自动纠偏

**Files:**
- Create: `src/feedback.ts`
- Modify: `src/db.ts`
- Modify: `src/router.ts`
- Modify: `frontend/app.js`

- [ ] **Step 1: db.ts 添加 skips 表 + CRUD**

在 `initDb` 函数的 SQL 字符串中添加：

```sql
    CREATE TABLE IF NOT EXISTS skips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id TEXT NOT NULL,
      song_name TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      scene TEXT NOT NULL DEFAULT '',
      session_id TEXT NOT NULL DEFAULT '',
      skipped_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

添加函数：

```typescript
export function addSkip(db: Database.Database, skip: {
  song_id: string; song_name: string; artist: string; scene: string; session_id: string;
}): void {
  db.prepare(
    'INSERT INTO skips (song_id, song_name, artist, scene, session_id) VALUES (?, ?, ?, ?, ?)'
  ).run(skip.song_id, skip.song_name, skip.artist, skip.scene, skip.session_id);
}

export function getRecentSkips(db: Database.Database, sessionId: string, limit: number) {
  return db.prepare(
    'SELECT song_id, song_name, artist, scene, session_id, skipped_at FROM skips WHERE session_id = ? ORDER BY id DESC LIMIT ?'
  ).all(sessionId, limit) as { song_id: string; song_name: string; artist: string; scene: string; session_id: string; skipped_at: string }[];
}
```

- [ ] **Step 2: 创建 src/feedback.ts**

```typescript
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { addSkip, getRecentSkips } from './db.js';
import { invokeClaude } from './claude.js';
import { assemblePrompt } from './context.js';
import { broadcast } from './ws.js';

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
  "play": ["新搜索词1", "新搜索词2", ...]
}`;

  try {
    const result = await invokeClaude(prompt, { db: opts.db, timeout: 30000 });
    return { corrected: true, say: result.say, play: result.play };
  } catch {
    return { corrected: false };
  }
}
```

- [ ] **Step 3: router.ts 修改 /api/hide**

修改 `/api/hide` 路由，添加 feedback 调用：

```typescript
  app.post('/api/hide', async (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const { songId, name, artist, scene, sessionId } = req.body;
    if (!songId) return res.status(400).json({ error: 'songId required' });

    addHiddenSong(opts.db, songId, name || '', artist || '');
    res.json({ hidden: true });

    // Trigger feedback check (fire-and-forget)
    if (sessionId) {
      handleSkip({
        db: opts.db,
        songId,
        songName: name || '',
        artist: artist || '',
        scene: scene || 'unknown',
        sessionId,
      }).then(result => {
        if (result.corrected && result.say) {
          broadcast('correction', { say: result.say, play: result.play });
        }
      }).catch(() => { /* ignore */ });
    }
  });
```

顶部 import 添加：

```typescript
import { handleSkip } from './feedback.js';
```

- [ ] **Step 4: 前端 hide 按钮传 sessionId 和 scene**

在 `frontend/app.js` 生成 session ID（页面加载时）：

```javascript
const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
```

修改 hide 按钮的 fetch body：

```javascript
      body: JSON.stringify({
        songId: track.songId,
        name: track.name,
        artist: track.artist,
        scene: state._currentScene || 'unknown',
        sessionId: sessionId,
      }),
```

- [ ] **Step 5: 前端处理 correction WebSocket 事件**

在 `ws.onmessage` 的 switch 中添加：

```javascript
        case 'correction':
          if (msg.payload?.say) {
            addChatMessage(msg.payload.say, 'ai');
          }
          if (msg.payload?.play && msg.payload.play.length > 0) {
            // Will be resolved by chat handler; for now just show message
          }
          break;
```

- [ ] **Step 6: 验证**

启动服务，连续点 HIDE 3 次。确认：chat 面板出现 Claude 纠错消息，mood-rules.md 追加了 auto-rule。

- [ ] **Step 7: Commit**

```bash
git add src/feedback.ts src/db.ts src/router.ts frontend/app.js
git commit -m "feat: skip-based auto-correction with mood-rules update (C)"
```

---

### Task 4: 模块 D — 场景自动触发

**Files:**
- Create: `src/triggers.ts`
- Modify: `src/router.ts`
- Modify: `src/server.ts`
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`

- [ ] **Step 1: 创建 src/triggers.ts**

```typescript
import type Database from 'better-sqlite3';
import { getPref } from './db.js';
import { broadcast } from './ws.js';

interface TriggerRule {
  id: string;
  check: (ctx: TriggerContext) => boolean;
  suggestion: string;
  scene: string;
}

interface TriggerContext {
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

const cooldowns = new Map<string, number>(); // ruleId -> lastTriggered timestamp

export function checkTriggers(ctx: TriggerContext): void {
  const now = Date.now();
  for (const rule of RULES) {
    if (!rule.check(ctx)) continue;
    const last = cooldowns.get(rule.id) || 0;
    if (now - last < 2 * 3600_000) continue; // 2 hour cooldown
    cooldowns.set(rule.id, now);
    broadcast('suggestion', { id: rule.id, text: rule.suggestion, scene: rule.scene });
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startTriggerLoop(getContext: () => Promise<TriggerContext>): void {
  if (timer) return;
  timer = setInterval(async () => {
    try {
      const ctx = await getContext();
      checkTriggers(ctx);
    } catch { /* ignore */ }
  }, 5 * 60_000); // every 5 minutes
}

export function stopTriggerLoop(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
```

- [ ] **Step 2: server.ts 启动 triggers 定时器**

在 `server.ts` 中添加 import：

```typescript
import { startTriggerLoop } from './triggers.js';
```

在 `createApp` 调用之后、`server.listen` 之前添加：

```typescript
  // start scene trigger loop
  startTriggerLoop(async () => {
    try {
      const ctx = await executor.getContext();
      const now = new Date();
      return { hour: now.getHours(), day: now.getDay(), weather: ctx.weather, calendar: ctx.calendar };
    } catch {
      return { hour: 0, day: 0, weather: '', calendar: '' };
    }
  });
```

- [ ] **Step 3: 前端 HTML 添加铃铛按钮**

在 `index.html` 的 `nav-actions` 中，theme-toggle 之前添加：

```html
        <button class="nav-btn bell-btn" id="bell-btn" title="场景建议" style="display:none">
          <span id="bell-badge" class="bell-badge" style="display:none">0</span>
          🔔
        </button>
```

在 `#app` 底部（footer 之前）添加 toast 容器：

```html
    <div class="toast-container" id="toast-container"></div>
```

- [ ] **Step 4: 前端 app.js 处理 suggestion 事件**

在 DOM refs 中添加：

```javascript
  bellBtn: $('#bell-btn'),
  bellBadge: $('#bell-badge'),
  toastContainer: $('#toast-container'),
```

WebSocket switch 中添加：

```javascript
        case 'suggestion':
          {
            const s = msg.payload;
            if (!s) break;
            const suggestionsEnabled = localStorage.getItem('claudio-suggestions') !== 'off';
            if (!suggestionsEnabled) break;
            showToast(s);
          }
          break;
```

添加 toast 函数：

```javascript
let pendingSuggestions = [];

function showToast(s) {
  pendingSuggestions.push(s);
  updateBellBadge();

  const toast = document.createElement('div');
  toast.className = 'toast-card';
  toast.innerHTML = `
    <span class="toast-text">${s.text}</span>
    <div class="toast-actions">
      <button class="toast-btn play" data-scene="${s.scene}">播放</button>
      <button class="toast-btn dismiss">忽略</button>
    </div>
  `;

  toast.querySelector('.play').addEventListener('click', async () => {
    toast.remove();
    pendingSuggestions = pendingSuggestions.filter(p => p.id !== s.id);
    updateBellBadge();
    // Trigger scene-based recommendation
    dom.chatInput.value = s.scene === 'birthday' ? '来点庆祝的歌' :
      s.scene === 'rainy_evening' ? '来点爵士' :
      s.scene === 'late_night' ? '来点轻柔助眠的' :
      s.scene === 'morning_commute' ? '来点提神的' :
      s.scene === 'friday_night' ? '来点放松的' :
      '来点轻松的';
    sendChat(dom.chatInput.value);
  });

  toast.querySelector('.dismiss').addEventListener('click', () => {
    toast.remove();
    pendingSuggestions = pendingSuggestions.filter(p => p.id !== s.id);
    updateBellBadge();
  });

  dom.toastContainer.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 30000);
}

function updateBellBadge() {
  const count = pendingSuggestions.length;
  if (count > 0) {
    dom.bellBtn.style.display = '';
    dom.bellBadge.style.display = '';
    dom.bellBadge.textContent = String(count);
  } else {
    dom.bellBadge.style.display = 'none';
  }
}

dom.bellBtn.addEventListener('click', () => {
  // Re-show latest suggestion toast
  const latest = pendingSuggestions[pendingSuggestions.length - 1];
  if (latest) showToast(latest);
});
```

- [ ] **Step 5: Toast / 铃铛 CSS**

在 `frontend/style.css` 末尾添加：

```css
/* ── Toast ── */
.toast-container {
  position: fixed; bottom: 24px; right: 24px;
  z-index: 9998; display: flex; flex-direction: column; gap: 8px;
  max-width: 360px;
}
.toast-card {
  background: var(--bg-card); border: 1px solid var(--accent);
  border-radius: var(--radius-md); padding: 14px 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  animation: toast-in .25s ease-out;
  display: flex; flex-direction: column; gap: 10px;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
.toast-text {
  font-size: 13px; color: var(--text-primary); font-weight: 600;
}
.toast-actions { display: flex; gap: 8px; }
.toast-btn {
  padding: 6px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); font-size: 11px; cursor: pointer;
  font-family: var(--font-body); transition: all .15s;
}
.toast-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.toast-btn.play {
  background: linear-gradient(135deg, var(--accent), var(--orange));
  color: #fff; border-color: transparent;
}
.toast-btn.play:hover { opacity: .85; }

/* ── Bell ── */
.bell-btn {
  position: relative;
}
.bell-badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--orange); color: #fff;
  border-radius: 50%; width: 16px; height: 16px;
  font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono);
}
```

- [ ] **Step 6: 验证**

启动服务，等待触发条件（或手动调 `/api/triggers/check`），确认前端弹出 toast 卡片，铃铛显示徽标。

- [ ] **Step 7: Commit**

```bash
git add src/triggers.ts src/server.ts src/router.ts frontend/app.js frontend/index.html frontend/style.css
git commit -m "feat: scene-based trigger suggestions with bell + toast (D)"
```

---

### Task 5: 模块 E — 品味成长曲线（播放统计报告）

**Files:**
- Create: `src/analytics.ts`
- Modify: `src/db.ts`
- Modify: `src/router.ts`
- Modify: `frontend/app.js`
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`

- [ ] **Step 1: db.ts 添加 play_stats 表 + CRUD**

在 `initDb` SQL 中添加：

```sql
    CREATE TABLE IF NOT EXISTS play_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL UNIQUE,
      stat_json TEXT NOT NULL DEFAULT '{}',
      insight_md TEXT NOT NULL DEFAULT '',
      generated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
```

添加函数：

```typescript
export function setPlayStats(db: Database.Database, period: string, statJson: string, insightMd: string): void {
  db.prepare(
    'INSERT INTO play_stats (period, stat_json, insight_md) VALUES (?, ?, ?) ON CONFLICT(period) DO UPDATE SET stat_json = excluded.stat_json, insight_md = excluded.insight_md, generated_at = datetime(\'now\')'
  ).run(period, statJson, insightMd);
}

export function getPlayStats(db: Database.Database, period: string) {
  const row = db.prepare(
    'SELECT period, stat_json, insight_md, generated_at FROM play_stats WHERE period = ?'
  ).get(period) as { period: string; stat_json: string; insight_md: string; generated_at: string } | undefined;
  return row ? { period: row.period, stat: JSON.parse(row.stat_json), insight: row.insight_md, generatedAt: row.generated_at } : null;
}

export function getPlayStatsAll(db: Database.Database) {
  return db.prepare(
    'SELECT period, generated_at FROM play_stats ORDER BY period DESC LIMIT 12'
  ).all() as { period: string; generated_at: string }[];
}
```

- [ ] **Step 2: 创建 src/analytics.ts**

```typescript
import type Database from 'better-sqlite3';
import { invokeClaude } from './claude.js';
import { getRecentPlays, getFavorites, setPlayStats } from './db.js';

interface PlayAggregation {
  totalPlays: number;
  topArtists: { name: string; count: number }[];
  topSongs: { name: string; artist: string; count: number }[];
  hourDistribution: Record<string, number>;
  newDiscoveries: { name: string; artist: string }[];
}

function aggregatePlays(db: Database.Database, period: string): PlayAggregation {
  const [year, month] = period.split('-').map(Number);
  const allRows = db.prepare(
    "SELECT song_id, song_name, artist, played_at FROM plays WHERE played_at >= ? AND played_at < ?"
  ).all(
    `${period}-01`,
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
  ) as { song_id: string; song_name: string; artist: string; played_at: string }[];

  const totalPlays = allRows.length;

  const artistCount = new Map<string, number>();
  const songCount = new Map<string, { name: string; artist: string; count: number }>();
  const hourDist: Record<string, number> = { '0-6': 0, '6-12': 0, '12-18': 0, '18-24': 0 };

  for (const row of allRows) {
    artistCount.set(row.artist, (artistCount.get(row.artist) || 0) + 1);
    const key = `${row.song_name}|${row.artist}`;
    const existing = songCount.get(key);
    if (existing) { existing.count++; } else { songCount.set(key, { name: row.song_name, artist: row.artist, count: 1 }); }
    const h = new Date(row.played_at + 'Z').getHours();
    if (h < 6) hourDist['0-6']++;
    else if (h < 12) hourDist['6-12']++;
    else if (h < 18) hourDist['12-18']++;
    else hourDist['18-24']++;
  }

  const topArtists = [...artistCount.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topSongs = [...songCount.values()]
    .sort((a, b) => b.count - a.count).slice(0, 5);

  // New discoveries: artists/songs appearing this month but not before
  const prevArtists = new Set(
    (db.prepare(
      "SELECT DISTINCT artist FROM plays WHERE played_at < ?"
    ).all(`${period}-01`) as { artist: string }[]).map(r => r.artist)
  );
  const newDiscoveries = [...new Set(allRows.map(r => `${r.song_name}|${r.artist}`))]
    .map(s => { const [name, artist] = s.split('|'); return { name, artist }; })
    .filter(d => !prevArtists.has(d.artist))
    .slice(0, 5);

  return { totalPlays, topArtists, topSongs, hourDistribution: hourDist, newDiscoveries };
}

export async function generateReport(db: Database.Database, period?: string): Promise<{
  period: string; stat: PlayAggregation; insight: string;
}> {
  const p = period || new Date().toISOString().slice(0, 7);
  const stat = aggregatePlays(db, p);

  const prompt = `你是一名音乐数据分析师。根据以下统计生成月度听歌报告：

- 总播放 ${stat.totalPlays} 次
- Top 歌手: ${stat.topArtists.map(a => `${a.name}(${a.count})`).join(', ')}
- Top 歌曲: ${stat.topSongs.map(s => `${s.name}(${s.count})`).join(', ')}
- 时段分布: 0-6点 ${stat.hourDistribution['0-6']}, 6-12点 ${stat.hourDistribution['6-12']}, 12-18点 ${stat.hourDistribution['12-18']}, 18-24点 ${stat.hourDistribution['18-24']}
- 本月新发现: ${stat.newDiscoveries.map(d => `${d.name} - ${d.artist}`).join(', ') || '无'}

请生成自然中文报告，4句话以内：
1. 总体画像（1句话）
2. 时间习惯（1句话）
3. 品味变化（1句话）
4. 下月推荐方向（1句话）

直接输出报告文案，不要 JSON。`;

  try {
    const result = await invokeClaude(prompt, { db, timeout: 30000 });
    setPlayStats(db, p, JSON.stringify(stat), result.say);
    return { period: p, stat, insight: result.say };
  } catch {
    const fallback = `${p} 月度听歌报告\\n\\n总播放 ${stat.totalPlays} 次\\n最爱歌手: ${stat.topArtists[0]?.name || '未知'}\\n最爱歌曲: ${stat.topSongs[0]?.name || '未知'}`;
    setPlayStats(db, p, JSON.stringify(stat), fallback);
    return { period: p, stat, insight: fallback };
  }
}
```

- [ ] **Step 3: router.ts 添加 stats 端点**

在 `createApp` 函数内添加：

```typescript
  // ── Stats ──

  app.get('/api/stats', (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    const period = (req.query.period as string) || new Date().toISOString().slice(0, 7);
    const stats = getPlayStats(opts.db, period);
    if (!stats) return res.json({ period, stat: null, insight: null });
    res.json(stats);
  });

  app.get('/api/stats/list', (_req: Request, res: Response) => {
    if (!opts.db) return res.json({ periods: [] });
    res.json({ periods: getPlayStatsAll(opts.db) });
  });

  app.post('/api/stats/generate', async (req: Request, res: Response) => {
    if (!opts.db) return res.status(503).json({ error: 'DB unavailable' });
    try {
      const period = req.body.period || new Date().toISOString().slice(0, 7);
      const report = await generateReport(opts.db, period);
      res.json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(502).json({ error: msg });
    }
  });
```

顶部 import 添加：

```typescript
import { generateReport } from './analytics.js';
import { getPlayStats, getPlayStatsAll } from './db.js';
```

- [ ] **Step 4: 前端 HTML 添加 STATS tab**

在 `chat-tabs` 中 FAVS 之后添加：

```html
          <button class="chat-tab" data-tab="stats">STATS</button>
```

在 favs-panel 之后添加：

```html
      <div class="panel stats-panel" id="stats-panel" style="display:none"></div>
```

- [ ] **Step 5: 前端 app.js 添加 stats tab 逻辑**

在 DOM refs 中添加：

```javascript
  statsPanel: $('#stats-panel'),
```

更新 tab 切换监听器，在条件判断中加入 stats：

```javascript
    dom.queuePanel.style.display = target === 'queue' ? '' : 'none';
    dom.favsPanel.style.display = target === 'favs' ? '' : 'none';
    dom.statsPanel.style.display = target === 'stats' ? '' : 'none';
    if (target === 'queue') renderQueuePanel();
    if (target === 'favs') renderFavsPanel();
    if (target === 'stats') renderStatsPanel();
```

添加 `renderStatsPanel` 函数：

```javascript
async function renderStatsPanel() {
  dom.statsPanel.innerHTML = '<div class="panel-empty">Loading...</div>';
  try {
    const listRes = await fetch('/api/stats/list');
    const listData = await listRes.json();
    const periods = listData.periods || [];
    const currentPeriod = periods[0]?.period || new Date().toISOString().slice(0, 7);

    const res = await fetch('/api/stats?period=' + currentPeriod);
    const data = await res.json();

    dom.statsPanel.innerHTML = '';

    // Period selector
    if (periods.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'stats-period-select';
      for (const p of periods) {
        const opt = document.createElement('option');
        opt.value = p.period;
        opt.textContent = p.period;
        opt.selected = p.period === currentPeriod;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', async () => {
        const r = await fetch('/api/stats?period=' + sel.value);
        const d = await r.json();
        renderReportContent(d);
      });
      dom.statsPanel.appendChild(sel);
    }

    if (data.insight) {
      renderReportContent(data);
    } else {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '暂无报告';
      dom.statsPanel.appendChild(empty);
    }

    // Generate button
    const btn = document.createElement('button');
    btn.className = 'stats-gen-btn';
    btn.textContent = '生成本月报告';
    btn.addEventListener('click', async () => {
      btn.textContent = '生成中…';
      btn.disabled = true;
      try {
        const r = await fetch('/api/stats/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const d = await r.json();
        renderReportContent(d);
      } catch { /* ignore */ } finally {
        btn.textContent = '生成本月报告';
        btn.disabled = false;
      }
    });
    dom.statsPanel.appendChild(btn);
  } catch {
    dom.statsPanel.innerHTML = '<div class="panel-empty">加载失败</div>';
  }
}

function renderReportContent(data) {
  // Clear existing report content but keep the period selector
  const existing = dom.statsPanel.querySelectorAll('.stats-report, .stats-gen-btn');
  existing.forEach(el => el.remove());

  const card = document.createElement('div');
  card.className = 'stats-report';

  const insight = document.createElement('div');
  insight.className = 'stats-insight';
  insight.textContent = data.insight;
  card.appendChild(insight);

  if (data.stat) {
    const detail = document.createElement('div');
    detail.className = 'stats-detail';
    const stat = data.stat;
    const lines = [
      `总播放: ${stat.totalPlays} 次`,
      `最爱歌手: ${(stat.topArtists || []).map(a => a.name).join(', ') || '—'}`,
      `新发现: ${(stat.newDiscoveries || []).map(d => d.name).join(', ') || '—'}`,
    ];
    detail.textContent = lines.join('  ·  ');
    card.appendChild(detail);
  }

  // Insert before the generate button
  const genBtn = dom.statsPanel.querySelector('.stats-gen-btn');
  if (genBtn) {
    dom.statsPanel.insertBefore(card, genBtn);
  } else {
    dom.statsPanel.appendChild(card);
  }
}
```

- [ ] **Step 6: Stats 面板样式**

在 `frontend/style.css` 末尾添加：

```css
/* ── Stats ── */
.stats-period-select {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-surface); color: var(--text-primary);
  font-size: 12px; font-family: var(--font-mono); margin-bottom: 12px;
  outline: none;
}
.stats-report {
  background: var(--bg-surface); border: 1px solid var(--border);
  border-radius: var(--radius-md); padding: 16px;
}
.stats-insight {
  font-size: 13px; line-height: 1.7; color: var(--text-primary);
  white-space: pre-wrap;
}
.stats-detail {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px solid var(--border);
  font-size: 11px; color: var(--text-muted);
  font-family: var(--font-mono);
}
.stats-gen-btn {
  width: 100%; margin-top: 10px;
  padding: 10px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--accent); background: transparent;
  color: var(--accent); font-size: 12px; cursor: pointer;
  font-family: var(--font-body); transition: all .15s;
}
.stats-gen-btn:hover:not(:disabled) {
  background: var(--accent-glow);
}
.stats-gen-btn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 7: 验证**

启动服务，播放几首歌后切换到 STATS tab。点击"生成本月报告"，确认报告卡片展示 Claude 生成的文案。

- [ ] **Step 8: Commit**

```bash
git add src/analytics.ts src/db.ts src/router.ts frontend/app.js frontend/index.html frontend/style.css
git commit -m "feat: monthly taste report with Claude-powered insights (E)"
```

---

## 验证清单

全部实现后，端到端验证：

1. **A — 预测队列**: 打开应用 → CHAT 面板出现场景推荐 → QUEUE 面板有推荐列表
2. **B — 情绪过渡**: 输入"心情不好" → 响应含 mood/arc → 进度条下显示情绪过渡步骤
3. **C — 跳过纠偏**: 连续 HIDE 3 首 → chat 出现纠错消息 → mood-rules.md 追加规则
4. **D — 场景触发**: 匹配触发条件 → 右下角 toast → 铃铛徽标 → 点击播放正常
5. **E — 品味报告**: 切换到 STATS tab → 生成报告 → 显示 Claude 文案
6. **回归**: 正常聊天点歌、收藏、隐藏、设置面板均不受影响
