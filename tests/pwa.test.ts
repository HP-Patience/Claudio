import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

describe('PWA shell', () => {
  it('manifest declares installable app icons', () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve('frontend/manifest.json'), 'utf-8'));

    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }),
    ]));
  });

  it('provides a service worker with install and fetch handlers', () => {
    const swPath = path.resolve('frontend/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const sw = fs.readFileSync(swPath, 'utf-8');

    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain('caches.open');
  });

  it('does not serve API routes from the static cache', async () => {
    const sw = fs.readFileSync(path.resolve('frontend/sw.js'), 'utf-8');
    const handlers: Record<string, (event: any) => void> = {};
    const networkResponse = { ok: true };
    const cachedResponse = { ok: true, stale: true };
    const fetchMock = vi.fn().mockResolvedValue(networkResponse);
    const cacheMatch = vi.fn().mockResolvedValue(cachedResponse);
    let responsePromise: Promise<unknown> | undefined;

    vm.runInNewContext(sw, {
      self: {
        location: { origin: 'http://localhost:3005' },
        addEventListener: (type: string, handler: (event: any) => void) => {
          handlers[type] = handler;
        },
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn() },
      },
      caches: { match: cacheMatch, keys: vi.fn(), open: vi.fn() },
      fetch: fetchMock,
      URL,
      Promise,
    });

    const event = {
      request: { method: 'GET', url: 'http://localhost:3005/api/config' },
      respondWith: vi.fn((promise: Promise<unknown>) => {
        responsePromise = promise;
      }),
    };

    handlers.fetch(event);

    expect(event.respondWith).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(event.request);
    expect(cacheMatch).not.toHaveBeenCalled();
    await expect(responsePromise).resolves.toBe(networkResponse);
  });

  it('registers the service worker from the page', () => {
    const html = fs.readFileSync(path.resolve('frontend/index.html'), 'utf-8');

    expect(html).toContain('navigator.serviceWorker.register');
    expect(html).toContain('/sw.js');
  });
});
