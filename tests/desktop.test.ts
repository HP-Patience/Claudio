import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { findAvailablePort } from '../electron/ports.js';

async function occupy(port: number): Promise<http.Server> {
  const server = http.createServer((_req, res) => res.end('busy'));
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return server;
}

describe('desktop ports', () => {
  it('uses preferred port when available', async () => {
    const port = await findAvailablePort(39895);

    expect(port).toBe(39895);
  });

  it('skips occupied preferred port and never returns 3000', async () => {
    const server = await occupy(39896);

    try {
      const port = await findAvailablePort(39896);

      expect(port).not.toBe(39896);
      expect(port).not.toBe(3000);
      expect(port).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => err ? reject(err) : resolve());
      });
    }
  });
});
