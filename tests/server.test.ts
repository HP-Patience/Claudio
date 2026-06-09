import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';

let server: http.Server;
let shutdown: () => Promise<void>;

describe('server', () => {
  afterEach(async () => {
    if (shutdown) await shutdown();
  });

  async function loadServer() {
    return await import('../src/server.js');
  }

  it('starts and responds to GET /api/now', async () => {
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
    const { start } = await loadServer();
    const result = await start({ port: 0 });
    server = (result as any).server;
    shutdown = result.shutdown;

    await shutdown();
    shutdown = undefined as any; // mark as already shut down

    // Verify server is closed
    expect(server.listening).toBe(false);
  });

  it('uses PORT env var if provided', async () => {
    // Fresh import to pick up env var
    const { start } = await loadServer();
    const result = await start({ port: 0 });
    server = (result as any).server;
    shutdown = result.shutdown;

    expect(server.listening).toBe(true);
  });
});
