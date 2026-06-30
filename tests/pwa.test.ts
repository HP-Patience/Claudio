import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

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

  it('registers the service worker from the page', () => {
    const html = fs.readFileSync(path.resolve('frontend/index.html'), 'utf-8');

    expect(html).toContain('navigator.serviceWorker.register');
    expect(html).toContain('/sw.js');
  });
});
