import { app, BrowserWindow, Menu, Tray } from 'electron';
import type http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { findAvailablePort } from './ports.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const require_ = createRequire(import.meta.url);

// Import from dist/server.js using runtime path (compiled to dist-electron/electron/,
// so ../../ reaches project root)
const { start } = require_('../../dist/server.js') as {
  start: (opts?: { port?: number }) => Promise<{ server: http.Server; shutdown: () => Promise<void> }>;
};

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let ncmProcess: ChildProcess | null = null;
let shutdownServer: (() => Promise<void>) | null = null;
let quitting = false;

function resourceRoot(): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : path.resolve(__dirname, '../..');
}

function dataDir(): string {
  const dir = app.getPath('userData');
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'user'), { recursive: true });
  return dir;
}

function startNcmApi(port: number): void {
  const root = resourceRoot();
  const apiDir = path.join(root, 'api-enhanced');
  if (!fs.existsSync(apiDir)) return;

  const log = fs.openSync(path.join(dataDir(), 'logs', 'ncm-api.log'), 'a');
  ncmProcess = spawn(process.execPath, ['app.js'], {
    cwd: apiDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
}

async function createWindow(url: string): Promise<void> {
  window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once('ready-to-show', () => window?.show());
  window.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    window?.hide();
  });

  await window.loadURL(url);
}

function createTray(): void {
  const iconPath = path.join(resourceRoot(), 'frontend', 'icons', 'icon-192.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Claudio');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 Claudio', click: () => window?.show() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]));
  tray.on('click', () => window?.show());
}

app.whenReady().then(async () => {
  const claudioPort = await findAvailablePort(3005);
  const ncmPort = await findAvailablePort(3001);
  const userData = dataDir();
  const resources = resourceRoot();

  process.env.PORT = String(claudioPort);
  process.env.NCM_API = `http://127.0.0.1:${ncmPort}`;
  process.env.CLAUDIO_DATA_DIR = userData;
  process.env.CLAUDIO_RESOURCE_DIR = resources;

  startNcmApi(ncmPort);
  const started = await start({ port: claudioPort });
  shutdownServer = started.shutdown;

  createTray();
  await createWindow(`http://127.0.0.1:${claudioPort}`);
});

app.on('before-quit', async () => {
  quitting = true;
  if (ncmProcess) {
    ncmProcess.kill();
    ncmProcess = null;
  }
  if (shutdownServer) {
    await shutdownServer();
    shutdownServer = null;
  }
});

app.on('window-all-closed', () => {});
