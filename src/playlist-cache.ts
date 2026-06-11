import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve('tmp/playlist-cache.json');

function ensureDir(): void {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCache(): Record<number, number[]> {
  ensureDir();
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch { /* corrupt file, start fresh */ }
  return {};
}

function saveCache(data: Record<number, number[]>): void {
  ensureDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
}

export function getCachedTrackIds(playlistId: number): number[] {
  const cache = loadCache();
  return cache[playlistId] ?? [];
}

export function addCachedTrackIds(playlistId: number, ids: number[]): void {
  const cache = loadCache();
  const existing = new Set(cache[playlistId] ?? []);
  for (const id of ids) existing.add(id);
  cache[playlistId] = [...existing];
  saveCache(cache);
}

export function removeCachedTrackIds(playlistId: number, ids: number[]): void {
  const cache = loadCache();
  if (!cache[playlistId]) return;
  const set = new Set(cache[playlistId]);
  for (const id of ids) set.delete(id);
  cache[playlistId] = [...set];
  if (cache[playlistId].length === 0) delete cache[playlistId];
  saveCache(cache);
}
