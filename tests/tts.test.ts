import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { synthesize, getCachePath, ensureCacheDir } from '../src/tts.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = 'tests/fixtures/tts-cache';

describe('tts', () => {
  beforeEach(() => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true });
    }
  });

  describe('getCachePath', () => {
    it('returns deterministic hash-based path for same text', () => {
      const p1 = getCachePath('hello world', CACHE_DIR);
      const p2 = getCachePath('hello world', CACHE_DIR);
      expect(p1).toBe(p2);
      expect(p1).toContain('tests');
      expect(path.extname(p1)).toBe('.mp3');
    });

    it('returns different paths for different text', () => {
      const p1 = getCachePath('hello', CACHE_DIR);
      const p2 = getCachePath('world', CACHE_DIR);
      expect(p1).not.toBe(p2);
    });
  });

  describe('ensureCacheDir', () => {
    it('creates cache directory if missing', () => {
      const dir = path.join(CACHE_DIR, 'missing');
      expect(fs.existsSync(dir)).toBe(false);

      ensureCacheDir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('does nothing if directory already exists', () => {
      ensureCacheDir(CACHE_DIR);
      // should not throw
      expect(fs.existsSync(CACHE_DIR)).toBe(true);
    });
  });

  describe('synthesize', () => {
    it('returns cached path without calling API on cache hit', async () => {
      const text = 'Good morning';
      const cachePath = getCachePath(text, CACHE_DIR);
      fs.writeFileSync(cachePath, 'fake-mp3-data');

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await synthesize(text, { cacheDir: CACHE_DIR });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toBe(cachePath);
    });

    it('calls Fish Audio API on cache miss and saves mp3', async () => {
      const mp3Data = new Uint8Array([1, 2, 3, 4]).buffer;
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(mp3Data, { status: 200 }),
      );

      const result = await synthesize('new text', { cacheDir: CACHE_DIR });

      const cachePath = getCachePath('new text', CACHE_DIR);
      expect(result).toBe(cachePath);
      expect(fs.existsSync(cachePath)).toBe(true);
    });

    it('returns error on API failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('API down'));

      const result = await synthesize('fail text', { cacheDir: CACHE_DIR });

      expect(result).toBeNull();
    });
  });
});
