import { searchSongs, getSongUrl, getSongDetail, getPersonalFM, getIntelligenceList } from './adapters/netease.js';
import { getCurrentWeather, getCurrentWeatherByCoords } from './adapters/weather.js';
import { getTodayEvents } from './adapters/feishu.js';

export interface PlayState {
  currentSong: PlayItem | null;
  queue: PlayItem[];
  isPlaying: boolean;
  isSpeaking: boolean;
  volume: number;
  isFmMode: boolean;
}

export interface PlayItem {
  songId: string;
  name: string;
  artist: string;
  url: string;
}

interface ActionObject {
  service: string;
  action: string;
  params: Record<string, unknown>;
}

type PlayAction = string | ActionObject;

function normalizePlayAction(action: PlayAction): Promise<PlayItem | null> {
  if (typeof action === 'string') {
    // Song ID string
    return resolveSongId(action);
  }
  if (action.service === 'music' && action.action === 'search_and_play') {
    return searchAndPlay(action.params.query as string ?? '');
  }
  return Promise.resolve(null);
}

async function resolveSongId(query: string): Promise<PlayItem | null> {
  // Treat string as search query, not song ID
  return searchAndPlay(query);
}

async function searchAndPlay(query: string): Promise<PlayItem | null> {
  const songs = await searchSongs(query, 1);
  if (!songs.length) return null;
  let url = '';
  try {
    url = await getSongUrl(Number(songs[0].id));
  } catch {
    // song URL may be unavailable (regional/DRM); still return song info
  }
  return { songId: String(songs[0].id), name: songs[0].name, artist: songs[0].artist, url };
}

export function createExecutor() {
  const state: PlayState = {
    currentSong: null,
    queue: [],
    isPlaying: false,
    isSpeaking: false,
    volume: 80,
    isFmMode: false,
  };

  return {
    getPlayState: (): PlayState => ({ ...state, queue: [...state.queue] }),

    executePlay: async (actions: PlayAction[]): Promise<PlayItem[]> => {
      const results = await Promise.all(actions.map(normalizePlayAction));
      const items = results.filter((r): r is PlayItem => r !== null);

      if (items.length > 0) {
        state.currentSong = items[0];
        state.queue = items;
        state.isPlaying = true;
        state.isFmMode = false;
      }

      return items;
    },

    acquireSpeaker: () => { state.isSpeaking = true; },
    releaseSpeaker: () => { state.isSpeaking = false; },

    startFM: async (): Promise<PlayItem | null> => {
      const song = await getPersonalFM();
      if (!song) return null;
      let url = '';
      try { url = await getSongUrl(Number(song.id)); } catch { /* ok */ }
      const item: PlayItem = { songId: String(song.id), name: song.name, artist: song.artist, url };
      state.currentSong = item;
      state.isFmMode = true;
      state.isPlaying = true;
      return item;
    },

    getNextFMSong: async (): Promise<PlayItem | null> => {
      const song = await getPersonalFM();
      if (!song) return null;
      let url = '';
      try { url = await getSongUrl(Number(song.id)); } catch { /* ok */ }
      return { songId: String(song.id), name: song.name, artist: song.artist, url };
    },

    stopFM: () => { state.isFmMode = false; },

    startIntelligence: async (songId: number, playlistId?: number): Promise<PlayItem[]> => {
      const songs = await getIntelligenceList(songId, playlistId ?? 0);
      let items: PlayItem[] = [];
      for (const s of songs) {
        let url = '';
        try { url = await getSongUrl(Number(s.id)); } catch { /* ok */ }
        items.push({ songId: String(s.id), name: s.name, artist: s.artist, url });
      }
      // Fallback: no playlist context, search by same artist
      if (!items.length && !playlistId) {
        const song = await getSongDetail(songId);
        if (song?.artist) {
          const fallbackSongs = await searchSongs(song.artist, 5);
          items = [];
          for (const s of fallbackSongs) {
            let url = '';
            try { url = await getSongUrl(Number(s.id)); } catch { /* ok */ }
            items.push({ songId: String(s.id), name: s.name, artist: s.artist, url });
          }
        }
      }
      if (items.length > 0) {
        state.currentSong = items[0];
        state.queue = items;
        state.isPlaying = true;
      }
      return items;
    },

    getContext: async (opts?: { lat?: number; lon?: number }) => {
      const lat = opts?.lat;
      const lon = opts?.lon;
      const [weatherResult, events] = await Promise.allSettled([
        (lat != null && lon != null)
          ? getCurrentWeatherByCoords(lat, lon)
          : Promise.reject(new Error('no location')),
        getTodayEvents(),
      ]);

      return {
        weather: weatherResult.status === 'fulfilled'
          ? `${weatherResult.value.city} ${weatherResult.value.temp}°C ${weatherResult.value.description}`
          : '',
        calendar: events.status === 'fulfilled'
          ? events.value.map((e) => `${e.summary}`).join(', ')
          : '',
      };
    },
  };
}
