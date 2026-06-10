let BASE = process.env.NCM_API ?? 'http://localhost:3001';
let COOKIE = '';

// Bitrate levels (br param for /song/url)
export const QUALITY_LEVELS = {
  standard: 128000,
  high: 192000,
  exhigh: 320000,
  lossless: 999000,
} as const;

export type QualityLevel = keyof typeof QUALITY_LEVELS;

let DEFAULT_BR = QUALITY_LEVELS.exhigh; // default to 320k

export function setDefaultBr(br: number): void {
  DEFAULT_BR = br;
}

export function getDefaultBr(): number {
  return DEFAULT_BR;
}

export function setNcmBase(url: string): void {
  if (url) BASE = url;
}

export function setNcmCookie(cookie: string): void {
  COOKIE = cookie;
}

export function getNcmCookie(): string {
  return COOKIE;
}

export function clearNcmCookie(): void {
  COOKIE = '';
}

export function getNcmBase(): string {
  return BASE;
}

export interface Song {
  id: number;
  name: string;
  artist: string;
  album: string;
}

async function ncmFetch<T>(path: string, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      const url = `${BASE}${path}`;
      const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
      if (COOKIE) headers['Cookie'] = `MUSIC_U=${COOKIE}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.error(`ncmFetch ${res.status} for ${path} (attempt ${i + 1})`);
        if (i === retries) throw new Error(`NCM API error: ${res.status}`);
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return res.json() as Promise<T>;
    } catch (err) {
      console.error(`ncmFetch error for ${path} (attempt ${i + 1}):`, err instanceof Error ? err.message : err);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

export async function searchSongs(keyword: string, limit = 10): Promise<Song[]> {
  const data = await ncmFetch<any>(
    `/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}`,
  );
  const songs = data?.result?.songs ?? [];
  return songs.map((s: any) => ({
    id: s.id,
    name: s.name,
    artist: s.artists?.[0]?.name ?? '',
    album: s.album?.name ?? '',
  }));
}

export async function getSongDetail(songId: number): Promise<Song | null> {
  const data = await ncmFetch<any>(`/song/detail?ids=${songId}`);
  const song = data?.songs?.[0];
  if (!song) return null;
  return {
    id: song.id,
    name: song.name,
    artist: song.ar?.[0]?.name ?? '',
    album: song.al?.name ?? '',
  };
}

export async function getSongUrl(songId: number, br?: number): Promise<string> {
  const bitrate = br ?? DEFAULT_BR;
  const data = await ncmFetch<any>(`/song/url?id=${songId}&br=${bitrate}`);
  return data?.data?.[0]?.url ?? '';
}

export async function getLoginStatus(): Promise<{ online: boolean; vipType: number; nickname?: string }> {
  const data = await ncmFetch<any>('/login/status?timestamp=' + Date.now());
  const acct = data?.data?.account;
  const profile = data?.data?.profile;
  return {
    online: acct?.id != null,
    vipType: acct?.vipType ?? 0,
    nickname: profile?.nickname ?? '',
  };
}

export async function getLyric(songId: number): Promise<string> {
  const data = await ncmFetch<any>(`/lyric?id=${songId}`);
  return data?.lrc?.lyric ?? '';
}

export async function getRecommendations(): Promise<Song[]> {
  const data = await ncmFetch<any>('/recommend/songs');
  const songs = data?.data?.dailySongs ?? [];
  return songs.map((s: any) => ({
    id: s.id,
    name: s.name,
    artist: s.ar?.[0]?.name ?? '',
    album: s.al?.name ?? '',
  }));
}

export async function getPersonalFM(): Promise<Song | null> {
  const data = await ncmFetch<any>('/personal_fm');
  const song = data?.data?.[0];
  if (!song) return null;
  return {
    id: song.id,
    name: song.name,
    artist: song.ar?.[0]?.name ?? '',
    album: song.al?.name ?? '',
  };
}

export async function getIntelligenceList(songId: number, playlistId: number): Promise<Song[]> {
  const data = await ncmFetch<any>(`/playmode/intelligence/list?id=${songId}&pid=${playlistId}`);
  const songs = data?.data ?? [];
  return songs.map((s: any) => ({
    id: s.id,
    name: s.name,
    artist: s.ar?.[0]?.name ?? '',
    album: s.al?.name ?? '',
  }));
}
