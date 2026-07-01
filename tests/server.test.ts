import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let server: http.Server;
let shutdown: () => Promise<void>;

describe('server', () => {
  afterEach(async () => {
    if (shutdown) await shutdown();
    shutdown = undefined as any;
    vi.unstubAllEnvs();
  });

  function useTempDb(prefix: string): void {
    vi.stubEnv('DB_PATH', path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random()}.db`));
    vi.resetModules();
  }

  async function loadServer() {
    return await import('../src/server.js');
  }

  it('starts and responds to GET /api/now', async () => {
    useTempDb('claudio-server-now');
    const { start } = await loadServer();
    const result = await start({ port: 0 }); // port 0 = random free port

    server = (result as any).server;
    shutdown = result.shutdown;

    expect(server).toBeDefined();
    const addr = server.address();
    expect(addr).not.toBeNull();
    expect(typeof addr).toBe('object');

    const port = (addr as any).port;
    const res = await fetch(`http://localhost:${port}/api/now`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('current');
    expect(body).toHaveProperty('queue');
  });

  it('shutdown closes server and cleans up', async () => {
    useTempDb('claudio-server-shutdown');
    const { start } = await loadServer();
    const result = await start({ port: 0 });
    server = (result as any).server;
    shutdown = result.shutdown;

    await shutdown();
    shutdown = undefined as any; // mark as already shut down

    // Verify server is closed
    expect(server.listening).toBe(false);
  });

  it('uses CLAUDIO_DATA_DIR for the embedded desktop database', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudio-desktop-'));
    vi.stubEnv('CLAUDIO_DATA_DIR', dataDir);
    vi.resetModules();

    const { start } = await loadServer();
    const result = await start({ port: 0 });
    server = (result as any).server;
    shutdown = result.shutdown;

    expect(fs.existsSync(path.join(dataDir, 'state.db'))).toBe(true);
  });
});
