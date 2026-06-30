# Play History Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a HISTORY tab that shows the latest 100 unique played songs, 20 per page, while preserving every raw play event in the database for analytics.

**Architecture:** Add a dedicated database query and `GET /api/history` route for display history, separate from `/api/now`. Record raw play events on the server after routes produce playable items. Add a focused frontend panel module wired into the existing tab/panel UI.

**Tech Stack:** Node.js, TypeScript, Express 5, better-sqlite3, Vitest, supertest, static ES modules, plain DOM APIs, CSS.

## Global Constraints

- Default project port is 3005; do not start the project on port 3000.
- Claude Code remains the only business-decision brain; do not add natural-language intent matching for this feature.
- The database must keep raw duplicate play events for analytics.
- The history page displays the latest 100 unique songs by `song_id`, keeping only each song's latest play.
- The UI stays within the existing single-page tab/panel structure; no new client-side router or framework.
- Keep changes surgical and reuse existing panel, track row, and route patterns.

---

## File Structure

- Modify `src/db.ts`
  - Add display-history types and `getPlayHistory(db, page, pageSize)`.
  - Keep `addPlay()` appending raw events unchanged.
- Modify `src/router.ts`
  - Import `addPlay` and `getPlayHistory`.
  - Add local helper `recordPlayedItems()` inside `createApp()`.
  - Add `GET /api/history`.
  - Call `recordPlayedItems()` after successful playback-producing routes.
- Modify `tests/db.test.ts`
  - Test unique display history, pagination, 100-song cap, and duplicate handling.
- Modify `tests/router.test.ts`
  - Mock new DB exports.
  - Test `GET /api/history`.
  - Test playback routes write raw play events.
- Modify `frontend/index.html`
  - Add `HISTORY` tab and `history-panel` container.
- Modify `frontend/js/dom.js`
  - Add `historyPanel` DOM reference.
- Modify `frontend/js/main.js`
  - Import and render `history-panel.js` during tab switching.
- Create `frontend/js/history-panel.js`
  - Fetch `/api/history`, render loading/empty/error/list/pagination, and replay via `/api/play/by-id`.
- Modify `frontend/style.css`
  - Add minimal history timestamp and pagination styles.
- Modify `tests/frontend-polish.test.ts`
  - Assert HISTORY markup, wiring, and panel states exist.

---

### Task 1: Database Display History Query

**Files:**
- Modify: `src/db.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes:
  - Existing `addPlay(db: Database.Database, play: Play): void` appends raw play rows.
  - Existing `plays` table columns: `id`, `song_id`, `song_name`, `artist`, `played_at`.
- Produces:
  - `export interface HistoryPlay { song_id: string; song_name: string; artist: string; played_at: string }`
  - `export interface HistoryPage { items: HistoryPlay[]; page: number; pageSize: number; total: number; totalPages: number }`
  - `export function getPlayHistory(db: Database.Database, page?: number, pageSize?: number): HistoryPage`

- [ ] **Step 1: Add failing DB tests**

Add `getPlayHistory` to the import in `tests/db.test.ts`:

```ts
import { initDb, addMessage, getMessages, addPlay, getRecentPlays, getPlayHistory, setPlan, getPlan, setPref, getPref, cleanup } from '../src/db.js';
```

Add these tests before the `setPlan and getPlan store and retrieve daily plan` test:

```ts
  it('getPlayHistory returns latest unique songs with duplicate raw plays collapsed', () => {
    db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)")
      .run('123', 'Old Name', 'Old Artist', '2026-06-30 08:00:00');
    db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)")
      .run('456', 'Another', 'Artist2', '2026-06-30 09:00:00');
    db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)")
      .run('123', 'New Name', 'New Artist', '2026-06-30 10:00:00');

    const history = getPlayHistory(db, 1, 20);

    expect(history).toEqual({
      items: [
        { song_id: '123', song_name: 'New Name', artist: 'New Artist', played_at: '2026-06-30 10:00:00' },
        { song_id: '456', song_name: 'Another', artist: 'Artist2', played_at: '2026-06-30 09:00:00' },
      ],
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('getPlayHistory paginates the latest 100 unique songs', () => {
    for (let i = 1; i <= 105; i += 1) {
      db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, datetime('2026-06-30 00:00:00', ? || ' minutes'))")
        .run(String(i), `Song ${i}`, `Artist ${i}`, i);
    }

    const pageOne = getPlayHistory(db, 1, 20);
    const pageFive = getPlayHistory(db, 5, 20);
    const pageSix = getPlayHistory(db, 6, 20);

    expect(pageOne.total).toBe(100);
    expect(pageOne.totalPages).toBe(5);
    expect(pageOne.items).toHaveLength(20);
    expect(pageOne.items[0].song_id).toBe('105');
    expect(pageFive.items).toHaveLength(20);
    expect(pageFive.items[19].song_id).toBe('6');
    expect(pageSix.items).toEqual([]);
    expect(pageSix.totalPages).toBe(5);
  });

  it('getPlayHistory ignores records without song_id', () => {
    db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)")
      .run('', 'Broken', 'Unknown', '2026-06-30 08:00:00');
    db.prepare("INSERT INTO plays (song_id, song_name, artist, played_at) VALUES (?, ?, ?, ?)")
      .run('123', 'Valid', 'Artist', '2026-06-30 09:00:00');

    const history = getPlayHistory(db, 1, 20);

    expect(history.items).toHaveLength(1);
    expect(history.items[0].song_id).toBe('123');
  });
```

- [ ] **Step 2: Run DB tests and verify they fail for the missing export**

Run:

```bash
npx vitest run tests/db.test.ts
```

Expected: FAIL because `getPlayHistory` is not exported from `src/db.ts`.

- [ ] **Step 3: Implement `getPlayHistory` in `src/db.ts`**

Add these exports after `getRecentPlays()`:

```ts
export interface HistoryPlay {
  song_id: string;
  song_name: string;
  artist: string;
  played_at: string;
}

export interface HistoryPage {
  items: HistoryPlay[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function getPlayHistory(db: Database.Database, page = 1, pageSize = 20): HistoryPage {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safePageSize = Math.min(20, Math.max(1, Math.floor(Number(pageSize) || 20)));
  const offset = (safePage - 1) * safePageSize;

  const uniqueCountRow = db.prepare(
    "SELECT COUNT(*) AS count FROM (SELECT song_id FROM plays WHERE song_id <> '' GROUP BY song_id)",
  ).get() as { count: number };
  const total = Math.min(uniqueCountRow.count, 100);
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);

  const items = db.prepare(`
    WITH ranked AS (
      SELECT
        song_id,
        song_name,
        artist,
        played_at,
        id,
        ROW_NUMBER() OVER (PARTITION BY song_id ORDER BY played_at DESC, id DESC) AS rn
      FROM plays
      WHERE song_id <> ''
    ),
    unique_plays AS (
      SELECT song_id, song_name, artist, played_at, id
      FROM ranked
      WHERE rn = 1
      ORDER BY played_at DESC, id DESC
      LIMIT 100
    )
    SELECT song_id, song_name, artist, played_at
    FROM unique_plays
    ORDER BY played_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(safePageSize, offset) as HistoryPlay[];

  return { items, page: safePage, pageSize: safePageSize, total, totalPages };
}
```

- [ ] **Step 4: Run DB tests and verify they pass**

Run:

```bash
npx vitest run tests/db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/db.ts tests/db.test.ts
git commit -m "feat: add play history query"
```

---

### Task 2: History API and Server-Side Play Recording

**Files:**
- Modify: `src/router.ts`
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes:
  - `addPlay(db, { song_id, song_name, artist })` from Task 1 existing DB API.
  - `getPlayHistory(db, page, pageSize)` from Task 1.
  - Playable item shape used by routes: `{ songId: string | number; name: string; artist: string; url?: string }`.
- Produces:
  - `GET /api/history?page=1&pageSize=20` returning `HistoryPage`.
  - Raw `plays` insertions for successful playback-producing routes.

- [ ] **Step 1: Add failing router mock exports and tests**

Update the `vi.mock('../src/db.js', ...)` block in `tests/router.test.ts` so it includes `addPlay` and `getPlayHistory`:

```ts
vi.mock('../src/db.js', () => ({
  initDb: vi.fn(),
  getMessages: vi.fn().mockReturnValue([
    { role: 'user', content: 'previous msg', created_at: '2026-06-09 07:00' },
  ]),
  getPlan: vi.fn().mockReturnValue({ songs: ['id1'], theme: 'morning' }),
  getRecentPlays: vi.fn().mockReturnValue([
    { song_id: '789', song_name: 'Take Five', artist: 'Dave Brubeck', played_at: '2026-06-09 08:00' },
  ]),
  getPlayHistory: vi.fn().mockReturnValue({
    items: [
      { song_id: '789', song_name: 'Take Five', artist: 'Dave Brubeck', played_at: '2026-06-09 08:00' },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  }),
  addMessage: vi.fn(),
  addPlay: vi.fn(),
  getPref: vi.fn().mockReturnValue(null),
  getPlayStatsAll: vi.fn().mockReturnValue([]),
  setPref: vi.fn(),
}));
```

Update the import in `tests/router.test.ts`:

```ts
import { getRecentPlays, getPlayHistory, getPref, setPref, addPlay } from '../src/db.js';
```

Update the NetEase mock to include direct-play helpers:

```ts
vi.mock('../src/adapters/netease.js', () => ({
  getNcmCookie: vi.fn().mockReturnValue('mock-cookie'),
  getPlaylistDetail: vi.fn(),
  addTracksToPlaylist: vi.fn(),
  getUserPlaylists: vi.fn().mockResolvedValue([]),
  createPlaylist: vi.fn(),
  removeTracksFromPlaylist: vi.fn(),
  getSongUrl: vi.fn().mockResolvedValue('https://music.126.net/mock.mp3'),
  getSongDetail: vi.fn().mockResolvedValue({ id: 123, name: 'Mock Song', artist: 'Mock Artist', album: 'Mock Album' }),
  getSimilarSongs: vi.fn().mockResolvedValue([{ id: 456, name: 'Similar Song', artist: 'Similar Artist', album: 'Similar Album' }]),
}));
```

Add these tests after the `GET /api/now` describe block:

```ts
  describe('GET /api/history', () => {
    it('returns paginated unique play history from DB', async () => {
      const res = await request(app).get('/api/history?page=2&pageSize=10');

      expect(res.status).toBe(200);
      expect(getPlayHistory).toHaveBeenCalledWith(expect.anything(), 2, 10);
      expect(res.body.items[0].song_name).toBe('Take Five');
      expect(res.body.totalPages).toBe(1);
    });

    it('returns an empty history when DB is unavailable', async () => {
      const appWithoutDb = createApp();

      const res = await request(appWithoutDb).get('/api/history');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    });
  });

  describe('play history recording', () => {
    it('records direct play by id after resolving a playable item', async () => {
      const res = await request(app)
        .post('/api/play/by-id')
        .send({ songId: '123' });

      expect(res.status).toBe(200);
      expect(addPlay).toHaveBeenCalledWith(expect.anything(), {
        song_id: '123',
        song_name: 'Mock Song',
        artist: 'Mock Artist',
      });
    });

    it('records chat executor results after successful playback resolution', async () => {
      const executor = {
        getContext: vi.fn().mockResolvedValue({ weather: '', calendar: '' }),
        executePlay: vi.fn().mockResolvedValue([
          { songId: '321', name: 'Chat Song', artist: 'Chat Artist', url: 'https://music.126.net/chat.mp3' },
        ]),
      };
      app = createApp({ db: {} as any, executor: executor as any });

      const res = await request(app)
        .post('/api/chat')
        .send({ text: '播放爵士乐' });

      expect(res.status).toBe(200);
      expect(addPlay).toHaveBeenCalledWith(expect.anything(), {
        song_id: '321',
        song_name: 'Chat Song',
        artist: 'Chat Artist',
      });
    });
  });
```

- [ ] **Step 2: Run router tests and verify they fail**

Run:

```bash
npx vitest run tests/router.test.ts
```

Expected: FAIL because `GET /api/history` does not exist and play routes do not call `addPlay`.

- [ ] **Step 3: Import DB helpers in `src/router.ts`**

Change the DB import at the top of `src/router.ts` from:

```ts
import { getRecentPlays, getPlan, addMessage, getMessages, getPref, setPref, addFavorite, removeFavorite, isFavorite, getFavorites, addHiddenSong, getPlayStats, getPlayStatsAll } from './db.js';
```

to:

```ts
import { getRecentPlays, getPlayHistory, getPlan, addMessage, addPlay, getMessages, getPref, setPref, addFavorite, removeFavorite, isFavorite, getFavorites, addHiddenSong, getPlayStats, getPlayStatsAll } from './db.js';
```

- [ ] **Step 4: Add local recording helper inside `createApp()`**

Immediately after `app.use(express.json());` in `src/router.ts`, add:

```ts
  function recordPlayedItems(items: unknown): void {
    if (!opts.db) return;
    const list = Array.isArray(items) ? items : [items];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const playable = item as { songId?: string | number; name?: string; artist?: string };
      if (!playable.songId) continue;
      addPlay(opts.db, {
        song_id: String(playable.songId),
        song_name: playable.name ?? '',
        artist: playable.artist ?? '',
      });
    }
  }
```

- [ ] **Step 5: Add `GET /api/history` in `src/router.ts`**

Add this route immediately after `GET /api/now`:

```ts
  app.get('/api/history', (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    if (!opts.db) return res.json({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
    res.json(getPlayHistory(opts.db, page, pageSize));
  });
```

- [ ] **Step 6: Record chat playback results once per successful result list**

In `src/router.ts`, inside `POST /api/chat`, add this block after the existing playback-mode / executePlay branches and before the TTS block:

```ts
    if (playedItems && playedItems.length > 0) {
      recordPlayedItems(playedItems);
    }
```

The surrounding code should become:

```ts
    }

    if (playedItems && playedItems.length > 0) {
      recordPlayedItems(playedItems);
    }

    // Handle TTS for the say message
    if (opts.executor && result.say) {
```

- [ ] **Step 7: Record direct playback routes**

In `POST /api/play/fm/start`, add `recordPlayedItems(item);` after the assistant message and before `res.json(item)`:

```ts
      if (opts.db) addMessage(opts.db, { role: 'assistant', content: `Playing: ${item.name} by ${item.artist}` });
      recordPlayedItems(item);
      res.json(item);
```

In `POST /api/play/intelligence/start`, add `recordPlayedItems(items);` after the message loop and before `res.json(items)`:

```ts
      if (opts.db) {
        for (const item of items) {
          addMessage(opts.db, { role: 'assistant', content: `Playing: ${item.name} by ${item.artist}` });
        }
      }
      recordPlayedItems(items);
      res.json(items);
```

In `POST /api/play/fm/next`, add `recordPlayedItems(item);` after broadcast and before `res.json(item)`:

```ts
      broadcast('play', { tracks: [item], fm: true });
      recordPlayedItems(item);
      res.json(item);
```

In `POST /api/play/by-id`, add `recordPlayedItems(item);` before `res.json(item)`:

```ts
      const item = { songId: String(detail.id), name: detail.name, artist: detail.artist, url };
      recordPlayedItems(item);
      res.json(item);
```

In `POST /api/play/similar`, add `recordPlayedItems(items);` before `res.json({ songs: items })` because the current frontend adds returned similar songs to the playback queue immediately:

```ts
      const items = await Promise.all(songs.map(async (s) => {
        let url = '';
        try { url = await getSongUrl(Number(s.id)); } catch { console.warn('[api] similar song URL failed'); }
        return { songId: String(s.id), name: s.name, artist: s.artist, url };
      }));

      recordPlayedItems(items);
      res.json({ songs: items });
```

In `POST /api/play/search`, add `recordPlayedItems(item);` before `res.json(item)`:

```ts
      const url = await getSongUrl(Number(songs[0].id));
      const item = { songId: String(songs[0].id), name: songs[0].name, artist: songs[0].artist, url };
      recordPlayedItems(item);
      res.json(item);
```

- [ ] **Step 8: Run router tests and verify they pass**

Run:

```bash
npx vitest run tests/router.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run DB and router tests together**

Run:

```bash
npx vitest run tests/db.test.ts tests/router.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

```bash
git add src/router.ts tests/router.test.ts
git commit -m "feat: expose play history api"
```

---

### Task 3: Frontend HISTORY Tab and Panel

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/js/dom.js`
- Modify: `frontend/js/main.js`
- Create: `frontend/js/history-panel.js`
- Modify: `frontend/style.css`
- Test: `tests/frontend-polish.test.ts`

**Interfaces:**
- Consumes:
  - `GET /api/history?page=<number>&pageSize=20` returning `{ items, page, pageSize, total, totalPages }`.
  - `POST /api/play/by-id` with body `{ songId: string }` returning playable item `{ songId, name, artist, url }`.
  - `playTrack(item)` and `setQueue(items)` from `frontend/js/audio-core.js`.
  - `state.queue` from `frontend/js/state.js`.
- Produces:
  - `export async function renderHistoryPanel(page = 1)` in `frontend/js/history-panel.js`.

- [ ] **Step 1: Add failing frontend structure tests**

Append these tests to `tests/frontend-polish.test.ts`:

```ts
  it('defines a history tab and panel container', () => {
    const html = fs.readFileSync(path.resolve('frontend/index.html'), 'utf-8');

    expect(html).toContain('data-tab="history"');
    expect(html).toContain('id="history-panel"');
  });

  it('wires the history panel through main and dom modules', () => {
    const domSource = fs.readFileSync(path.resolve('frontend/js/dom.js'), 'utf-8');
    const mainSource = fs.readFileSync(path.resolve('frontend/js/main.js'), 'utf-8');

    expect(domSource).toContain('historyPanel');
    expect(mainSource).toContain("./history-panel.js");
    expect(mainSource).toContain("target === 'history'");
    expect(mainSource).toContain('renderHistoryPanel');
  });

  it('history panel implements loading, empty, failure, pagination, and replay states', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/history-panel.js'), 'utf-8');

    expect(source).toContain('/api/history?page=');
    expect(source).toContain('暂无播放记录');
    expect(source).toContain('加载历史失败');
    expect(source).toContain('history-pagination');
    expect(source).toContain('/api/play/by-id');
  });
```

- [ ] **Step 2: Run frontend polish tests and verify they fail**

Run:

```bash
npx vitest run tests/frontend-polish.test.ts
```

Expected: FAIL because history markup and `history-panel.js` do not exist.

- [ ] **Step 3: Add HISTORY tab and panel in `frontend/index.html`**

In the `.chat-tabs` group, add the HISTORY button after PLAYLISTS:

```html
          <button class="chat-tab" data-tab="playlists">PLAYLISTS</button>
          <button class="chat-tab" data-tab="history">HISTORY</button>
```

In the panel list, add the history panel after `playlists-panel`:

```html
      <div class="panel playlists-panel" id="playlists-panel" style="display:none"></div>
      <div class="panel history-panel" id="history-panel" style="display:none"></div>
```

- [ ] **Step 4: Add DOM reference in `frontend/js/dom.js`**

Add `historyPanel` after `playlistsPanel`:

```js
  playlistsPanel: $('#playlists-panel'),
  historyPanel: $('#history-panel'),
```

- [ ] **Step 5: Create `frontend/js/history-panel.js`**

Create the file with this content:

```js
// Claudio FM — 历史播放面板
import { state } from './state.js';
import { dom } from './dom.js';
import { playTrack, setQueue } from './audio-core.js';

const PAGE_SIZE = 20;

function formatPlayedAt(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderPagination(page, totalPages) {
  if (totalPages <= 1) return null;
  const wrap = document.createElement('div');
  wrap.className = 'history-pagination';

  for (let p = 1; p <= totalPages; p += 1) {
    const btn = document.createElement('button');
    btn.className = 'history-page-btn' + (p === page ? ' active' : '');
    btn.textContent = String(p);
    btn.disabled = p === page;
    btn.addEventListener('click', () => renderHistoryPanel(p));
    wrap.appendChild(btn);
  }

  return wrap;
}

async function playHistoryItem(item, button) {
  button.textContent = '…';
  button.disabled = true;
  try {
    const res = await fetch('/api/play/by-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: item.song_id }),
    });
    const playable = await res.json();
    if (!playable.url) return;
    state.queue.unshift(playable);
    setQueue(state.queue);
    playTrack(playable);
    await renderHistoryPanel(1);
  } finally {
    button.textContent = '▶';
    button.disabled = false;
  }
}

function renderItems(items) {
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'track-item history-item';

    const info = document.createElement('div');
    info.className = 'track-item-info';

    const name = document.createElement('div');
    name.className = 'track-item-name';
    name.textContent = item.song_name;

    const artist = document.createElement('div');
    artist.className = 'track-item-artist';
    artist.textContent = item.artist;

    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = formatPlayedAt(item.played_at);

    info.appendChild(name);
    info.appendChild(artist);
    info.appendChild(time);
    row.appendChild(info);

    const playBtn = document.createElement('button');
    playBtn.className = 'track-action';
    playBtn.textContent = '▶';
    playBtn.title = 'Play again';
    playBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      playHistoryItem(item, playBtn);
    });
    row.appendChild(playBtn);

    dom.historyPanel.appendChild(row);
  }
}

export async function renderHistoryPanel(page = 1) {
  dom.historyPanel.innerHTML = '<div class="panel-empty">Loading...</div>';
  try {
    const res = await fetch(`/api/history?page=${page}&pageSize=${PAGE_SIZE}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const items = data.items || [];

    dom.historyPanel.innerHTML = '';
    if (items.length === 0) {
      dom.historyPanel.innerHTML = '<div class="panel-empty">暂无播放记录</div>';
      return;
    }

    renderItems(items);
    const pagination = renderPagination(data.page || page, data.totalPages || 0);
    if (pagination) dom.historyPanel.appendChild(pagination);
  } catch {
    dom.historyPanel.innerHTML = '<div class="panel-empty">加载历史失败 <button class="history-retry" type="button">重试</button></div>';
    dom.historyPanel.querySelector('.history-retry')?.addEventListener('click', () => renderHistoryPanel(page));
  }
}
```

- [ ] **Step 6: Wire history panel in `frontend/js/main.js`**

Add the import after playlists:

```js
import * as historyPanel from './history-panel.js';
```

In the tab switching block, add display toggling after playlists:

```js
    dom.historyPanel.style.display = target === 'history' ? '' : 'none';
```

Add active class toggling after playlists:

```js
    dom.historyPanel.classList.toggle('active', target === 'history');
```

Add render call after playlists:

```js
    if (target === 'history') historyPanel.renderHistoryPanel();
```

The final tab body should include these history lines alongside existing chat/queue/favs/stats/playlists handling.

- [ ] **Step 7: Add minimal styles in `frontend/style.css`**

Add these rules after the existing `.track-item-artist` block:

```css
.history-time {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 3px;
  font-family: var(--font-mono);
  opacity: 0.75;
}

.history-pagination {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding: 14px 0 4px;
}

.history-page-btn,
.history-retry {
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 5px 9px;
  font-family: var(--font-mono);
  font-size: 11px;
  cursor: pointer;
}

.history-page-btn:hover,
.history-retry:hover,
.history-page-btn.active {
  color: var(--accent);
  border-color: var(--accent);
}

.history-page-btn:disabled {
  cursor: default;
  opacity: 1;
}
```

- [ ] **Step 8: Run frontend polish tests and verify they pass**

Run:

```bash
npx vitest run tests/frontend-polish.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run focused backend and frontend tests**

Run:

```bash
npx vitest run tests/db.test.ts tests/router.test.ts tests/frontend-polish.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add frontend/index.html frontend/js/dom.js frontend/js/main.js frontend/js/history-panel.js frontend/style.css tests/frontend-polish.test.ts
git commit -m "feat: add play history panel"
```

---

### Task 4: End-to-End Verification and Browser Check

**Files:**
- No planned source changes.
- If verification reveals a defect, fix only the failing file and add or update the corresponding test from Tasks 1-3.

**Interfaces:**
- Consumes:
  - `npm test` full Vitest suite.
  - `npm run dev` server, which must run on the project default port 3005 and not on port 3000.
  - Browser-loaded frontend at the local dev server.
- Produces:
  - Verified working history page.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS. If a test fails because it expects old frontend markup or old router mocks, update only that test to match the implemented history behavior and rerun `npm test`.

- [ ] **Step 2: Start the app on the allowed default port**

Run:

```bash
npm run dev
```

Expected: server starts on port 3005. If the server attempts to use port 3000, stop it and fix the relevant startup configuration before continuing.

- [ ] **Step 3: Open the frontend and verify HISTORY tab presence**

In a browser, open the local app served by the dev command.

Expected:

- The chat tab row contains `HISTORY`.
- Clicking `HISTORY` shows either `暂无播放记录` or a list of history rows.
- No browser console errors appear when switching tabs.

- [ ] **Step 4: Trigger a playable item and verify it appears in history**

Use one available path that returns a playable item in the local environment:

- Search or chat playback if NetEase API and credentials are available.
- Or click a favorite/history replay item if the database already contains playable records.

Expected:

- A song starts or is queued by the existing playback flow.
- Reopening `HISTORY` shows the song name and artist.
- The row includes a formatted recent play time.

- [ ] **Step 5: Verify frontend duplicate display behavior**

Play the same song again through the history replay button.

Expected:

- The database receives another raw `plays` event through `/api/play/by-id`.
- The HISTORY panel still shows the song once.
- The song moves to the first page because its latest play time changed.

- [ ] **Step 6: Verify pagination behavior when enough data exists**

If the local database has more than 20 unique songs, click page buttons.

Expected:

- Each page shows at most 20 rows.
- Page buttons do not exceed 5 pages.
- The active page button is highlighted and disabled.

If the local database has fewer than 21 unique songs, use the automated DB and router tests as pagination verification for this run.

- [ ] **Step 7: Stop the dev server**

Stop the `npm run dev` process with Ctrl+C.

Expected: the dev server exits cleanly.

- [ ] **Step 8: Commit verification fixes if any were needed**

If Task 4 required code or test changes, commit only those files:

```bash
git add <changed-files-from-task-4>
git commit -m "fix: polish play history verification"
```

If Task 4 required no changes, do not create an empty commit.

---

## Self-Review

**Spec coverage:**

- Dedicated `GET /api/history?page=1&pageSize=20`: Task 2.
- Write raw `plays` events after successful playback-producing routes: Task 2.
- HISTORY tab and panel: Task 3.
- Latest 100 unique songs, 20 per page: Task 1 and Task 2.
- Empty, failure, retry, pagination, replay: Task 3.
- Backend and frontend tests: Tasks 1-3.
- Manual browser verification on a non-3000 port: Task 4.

**Placeholder scan:** This plan contains concrete file paths, commands, function signatures, and code snippets for every implementation step. It does not use placeholder markers.

**Type consistency:** `HistoryPlay`, `HistoryPage`, `getPlayHistory`, `recordPlayedItems`, and `renderHistoryPanel` are named consistently across tasks. The API response uses `items`, `page`, `pageSize`, `total`, and `totalPages` consistently between backend and frontend.
