import { searchSongs, getSongUrl } from './adapters/netease.js';
import { getCurrentWeather, getCurrentWeatherByCoords } from './adapters/weather.js';
import { getTodayEvents } from './adapters/feishu.js';

export interface PlayState {
  currentSong: PlayItem | null;
  queue: PlayItem[];
  isPlaying: boolean;
  isSpeaking: boolean;
  volume: number;
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
      }

      return items;
    },

    acquireSpeaker: () => { state.isSpeaking = true; },
    releaseSpeaker: () => { state.isSpeaking = false; },

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
