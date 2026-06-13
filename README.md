# Claudio FM

AI-powered music assistant. Tell it what you feel like hearing — it picks the songs, announces them, and controls your speakers.

```
Say "play some jazz" → LLM reasons → searches NetEase Cloud Music → plays + TTS DJ
```

## Quick Start

```bash
# 1. Start NetEase Cloud Music API (separate service)
cd api-enhanced
npm install
PORT=3001 node app.js

# 2. Start Claudio
npm install
npm run dev          # http://localhost:3005
```

**Or** use `start-claudio.bat` on Windows (starts both services with readiness polling).

### First-time setup

1. Open http://localhost:3005
2. Click ⚙ → set your **API Key** (Anthropic or OpenAI-compatible)
3. **Test Connection** → **Save**

See [docs/user-manual.md](docs/user-manual.md) for full usage guide.

## Architecture

```
User / frontend (natural language)
    │
    ▼
Context Collector  ── weather, calendar, time, history
    │
    ▼
Claude / LLM  ── reasons, outputs JSON action sequence
    │
    ▼
Action Executor  ── search → play → TTS → UPnP
```

- **Context Collector**: [src/context.ts](src/context.ts) — loads user corpus, fetches weather/calendar
- **Orchestrator**: [src/claude.ts](src/claude.ts) — calls Anthropic / OpenAI-compatible API, parses structured JSON output
- **Action Executor**: [src/executor.ts](src/executor.ts) — executes play commands from LLM output
- **Service Adapters**: NetEase, Weather, Feishu Calendar, UPnP, Fish Audio TTS under [src/adapters/](src/adapters/)

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js + TypeScript (`tsx`) |
| HTTP | Express 5 |
| Real-time | WebSocket (`ws`, path `/stream`) |
| Database | SQLite (`better-sqlite3`) |
| LLM | Anthropic Messages API / OpenAI-compatible |
| Frontend | Vanilla JS + HTML/CSS (single file) |
| Tests | Vitest + supertest |

## Commands

```bash
npm run dev          # start dev server
npm test             # run all tests
npm run test:watch   # watch mode
```

## Config

Two-layer: `.env` file + SQLite `prefs` table. DB values take priority.
Configured in-app via the settings panel or `POST /api/config`.

API 配置测试自动检测 Anthropic vs OpenAI-compatible 端点。

## NCM API

Claudio requires [NeteaseCloudMusicApiEnhanced](https://github.com/547174207/NeteaseCloudMusicApiEnhanced) (v4.35.1).
This is a third-party project with its own dependencies — run `npm install` inside `api-enhanced/` before use.

## Related

- [CLAUDE.md](CLAUDE.md) — development reference (Chinese)
- [docs/user-manual.md](docs/user-manual.md) — user manual (Chinese)
- [docs/](docs/) — additional documentation
