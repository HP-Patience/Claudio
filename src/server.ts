import express from 'express';
import http from 'node:http';
import Database from 'better-sqlite3';
import { initDb } from './db.js';
import { createApp } from './router.js';
import { createWss } from './ws.js';
import { createExecutor } from './executor.js';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DB_PATH ?? 'state.db';

interface StartOptions {
  port?: number;
}

export async function start(options: StartOptions = {}) {
  const port = options.port !== undefined ? options.port : (Number(process.env.PORT) || 3005);

  // init DB
  const dbDir = path.dirname(DB_PATH);
  if (dbDir && dbDir !== '.') {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const db = new Database(DB_PATH);
  initDb(db);

  // create app
  const executor = createExecutor();
  const app = createApp({ db, executor });

  // serve frontend static files
  app.use(express.static(path.resolve('frontend')));

  // create HTTP server
  const server = http.createServer(app);

  // attach WebSocket
  createWss(server);

  return new Promise<{ server: http.Server; shutdown: () => Promise<void> }>((resolve) => {
    server.listen(port, () => {
      const shutdown = async () => {
        return new Promise<void>((resolveClose) => {
          server.close(() => {
            db.close();
            resolveClose();
          });
        });
      };

      resolve({ server, shutdown });
    });
  });
}

// Direct run: `tsx src/server.ts`
const isMain =
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js');

if (isMain) {
  start().then(({ shutdown }) => {
    console.log(`Claudio server started on http://localhost:${process.env.PORT || 3000}`);

    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await shutdown();
      process.exit(0);
    });
  });
}
