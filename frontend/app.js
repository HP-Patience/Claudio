// Claudio FM — 前端交互逻辑

// ── 状态 ──
const state = {
  theme: localStorage.getItem('claudio-theme') || 'dark',
  isPlaying: false,
  currentTrack: null,
  volume: parseInt(localStorage.getItem('claudio-volume') || '80'),
  queue: [],
  lovedSongs: new Set(),
  ncmLoggedIn: false,
  ncmVipType: 0,
  ncmNickname: '',
  isFmMode: false,
  isSmartMode: false,
  playMode: localStorage.getItem('claudio-playmode') || 'list',
  _shuffleHistory: [],
  _playlists: [],           // cached playlist list for dropdown
};

// ── 工具 ──

function resolveAudioUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('music.126.net') || u.hostname.endsWith('music.163.com')) {
      return '/api/proxy/audio?url=' + encodeURIComponent(url);
    }
  } catch { /* not a valid URL, pass through */ }
  return url;
}

let userCoords = null; // { lat, lon } from geolocation

const sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);

// ── DOM refs ──
const $ = (s) => document.querySelector(s);
const dom = {
  clock: $('#clock'),
  weekday: $('#weekday'),
  dateStr: $('#date-str'),
  onAir: $('#on-air'),
  nowPlaying: $('#now-playing'),
  playBtn: $('#play-btn'),
  prevBtn: $('#prev-btn'),
  nextBtn: $('#next-btn'),
  fmBtn: $('#fm-btn'),
  smartBtn: $('#smart-btn'),
  progress: $('.progress-container'),
  progressBar: $('#progress-bar'),
  currentTime: $('#current-time'),
  duration: $('#duration'),
  volumeSlider: $('#volume'),
  waveform: $('#waveform'),
  chatMessages: $('#chat-messages'),
  chatInput: $('#chat-input'),
  sendBtn: $('#send-btn'),
  connectionStatus: $('#connection-status'),
  ncmStatus: $('#ncm-status'),
  queueCount: $('#queue-count'),
  favsCount: $('#favs-count'),
  tokenUsage: $('#token-usage'),
  themeToggle: $('#theme-toggle'),
  settingsToggle: $('#settings-toggle'),
  settingsModal: $('#settings-modal'),
  settingsClose: $('#settings-close'),
  settingsApiKey: $('#settings-api-key'),
  settingsBaseUrl: $('#settings-base-url'),
  settingsApiModel: $('#settings-api-model'),
  settingsFetchModels: $('#settings-fetch-models'),
  modelDropdown: $('#model-dropdown'),
  settingsNcmApi: $('#settings-ncm-api'),
  settingsNcmQuality: $('#settings-ncm-quality'),
  settingsWeatherKey: $('#settings-weather-key'),
  settingsFishKey: $('#settings-fish-key'),
  settingsFeishuAppId: $('#settings-feishu-app-id'),
  settingsFeishuAppSecret: $('#settings-feishu-app-secret'),
  settingsUpnpDevices: $('#settings-upnp-devices'),
  settingsStatus: $('#settings-status'),
  settingsTest: $('#settings-test'),
  settingsSave: $('#settings-save'),
  loveBtn: $('#love-btn'),
  hideBtn: $('#hide-btn'),
  similarBtn: $('#similar-btn'),
  fmBadge: $('#fm-badge'),
  smartBadge: $('#smart-badge'),
  playerStatus: $('.player-status'),
  queuePanel: $('#queue-panel'),
  favsPanel: $('#favs-panel'),
  statsPanel: $('#stats-panel'),
  chatPanel: $('#chat-panel'),
  arcIndicator: $('#arc-indicator'),
  bellBtn: $('#bell-btn'),
  bellBadge: $('#bell-badge'),
  toastContainer: $('#toast-container'),
  ncmLoginBtn: $('#ncm-login-btn'),
  ncmLoginModal: $('#ncm-login-modal'),
  ncmLoginClose: $('#ncm-login-close'),
  qrContainer: $('#qr-container'),
  qrImage: $('#qr-image'),
  qrPlaceholder: $('#qr-placeholder'),
  qrStatus: $('#qr-status'),
  loginPhone: $('#login-phone'),
  loginPassword: $('#login-password'),
  pwdLoginBtn: $('#pwd-login-btn'),
  pwdLoginStatus: $('#pwd-login-status'),
  playlistsPanel: $('#playlists-panel'),
  addToPlaylistBtn: $('#add-to-playlist-btn'),
  addToPlaylistDropdown: $('#add-to-playlist-dropdown'),
  playModeBtn: $('#playmode-btn'),
  playModeDropdown: $('#playmode-dropdown'),
  playlistCreateModal: $('#playlist-create-modal'),
  playlistCreateClose: $('#playlist-create-close'),
  playlistCreateCancel: $('#playlist-create-cancel'),
  playlistCreateConfirm: $('#playlist-create-confirm'),
  playlistName: $('#playlist-name'),
  playlistPrivate: $('#playlist-private'),
  playlistCreateStatus: $('#playlist-create-status'),
};

// ── audio ──
const audio = new Audio();
audio.volume = state.volume / 100;

// ── theme ──
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('claudio-theme', theme);
  dom.themeToggle.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
}

setTheme(state.theme);

dom.themeToggle.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// ── clock ──
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  dom.clock.textContent = `${h}:${m}`;

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  dom.weekday.textContent = weekdays[now.getDay()];

  const day = String(now.getDate()).padStart(2, '0');
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  dom.dateStr.textContent = `${day} ${months[now.getMonth()]} ${now.getFullYear()}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── audio events ──
audio.addEventListener('timeupdate', () => {
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    dom.progressBar.style.width = `${pct}%`;
    dom.currentTime.textContent = formatTime(audio.currentTime);
    dom.duration.textContent = formatTime(audio.duration);
  }
});

audio.addEventListener('ended', () => {
  state.isPlaying = false;
  dom.playBtn.textContent = '▶';
  dom.onAir.classList.remove('active');
  if (state.isFmMode) {
    fetchNextFm();
  } else if (state.isSmartMode && state.queue.length > 1) {
    nextTrack();
  } else if (state.playMode === 'single') {
    replayCurrentTrack();
  } else {
    state.isSmartMode = false;
    updateModeDisplay();
    nextTrack();
  }
});

audio.addEventListener('play', () => {
  state.isPlaying = true;
  dom.playBtn.textContent = '⏸';
  dom.waveform.classList.remove('paused');
});

audio.addEventListener('pause', () => {
  state.isPlaying = false;
  dom.playBtn.textContent = '▶';
  dom.waveform.classList.add('paused');
});

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── player controls ──
dom.playBtn.addEventListener('click', () => togglePlay());
dom.prevBtn.addEventListener('click', () => prevTrack());
dom.nextBtn.addEventListener('click', () => nextTrack());

dom.fmBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/play/fm/start', { method: 'POST' });
    if (!res.ok) showModeToast('FM 启动失败');
  } catch { showModeToast('FM 启动失败'); }
});

dom.smartBtn.addEventListener('click', async () => {
  const track = state.currentTrack;
  if (!track || !track.songId) { showModeToast('请先播放一首歌'); return; }
  try {
    const res = await fetch('/api/play/intelligence/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: track.songId }),
    });
    if (!res.ok) showModeToast('智能模式不可用');
  } catch { showModeToast('智能模式启动失败'); }
});

// ── love button ──
dom.loveBtn.addEventListener('click', async () => {
  const track = state.currentTrack;
  if (!track || !track.songId) return;

  const loved = state.lovedSongs.has(track.songId);
  try {
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: track.songId, name: track.name, artist: track.artist }),
    });
    const data = await res.json();
    if (data.loved) {
      state.lovedSongs.add(track.songId);
      dom.loveBtn.textContent = '♥';
      dom.loveBtn.classList.add('loved');
    } else {
      state.lovedSongs.delete(track.songId);
      dom.loveBtn.textContent = '♡';
      dom.loveBtn.classList.remove('loved');
    }
  } catch { /* ignore */ }
});

// ── hide button ──
dom.hideBtn.addEventListener('click', async () => {
  const track = state.currentTrack;
  if (!track || !track.songId) return;

  try {
    await fetch('/api/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        songId: track.songId,
        name: track.name,
        artist: track.artist,
        scene: state._currentScene || 'unknown',
        sessionId: sessionId,
      }),
    });
  } catch { /* ignore */ }

  if (state.queue.length > 1) {
    await nextTrack();
  }
});

// ── similar songs button ──
dom.similarBtn.addEventListener('click', async () => {
  const track = state.currentTrack;
  if (!track || !track.songId) { showModeToast('请先播放一首歌'); return; }

  dom.similarBtn.disabled = true;
  dom.similarBtn.textContent = '…';
  try {
    const res = await fetch('/api/play/similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ songId: track.songId }),
    });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const songs = data.songs || [];
    if (songs.length === 0) { showModeToast('没有找到相似歌曲'); return; }

    state.queue.push(...songs);
    setQueue(state.queue);
    showModeToast(`已添加 ${songs.length} 首相似歌曲`);
  } catch {
    showModeToast('获取相似歌曲失败');
  } finally {
    dom.similarBtn.textContent = '相似';
    dom.similarBtn.disabled = false;
  }
});

// ── tab switching ──
let activePanel = 'chat';
document.querySelectorAll('.chat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    if (activePanel === target) return;
    activePanel = target;
    document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    dom.chatPanel.style.display = target === 'chat' ? '' : 'none';
    dom.queuePanel.style.display = target === 'queue' ? '' : 'none';
    dom.favsPanel.style.display = target === 'favs' ? '' : 'none';
    dom.statsPanel.style.display = target === 'stats' ? '' : 'none';
    dom.playlistsPanel.style.display = target === 'playlists' ? '' : 'none';
    if (target === 'queue') renderQueuePanel();
    if (target === 'favs') renderFavsPanel();
    if (target === 'stats') renderStatsPanel();
    if (target === 'playlists') renderPlaylistsPanel();
  });
});

// ── queue panel ──
function refreshQueuePanel() {
  if (activePanel === 'queue') renderQueuePanel();
}

function renderQueuePanel() {
  dom.queuePanel.innerHTML = '';
  dom.queueCount.textContent = String(state.queue.length);

  if (state.queue.length === 0) {
    dom.queuePanel.innerHTML = '<div class="panel-empty">Queue is empty</div>';
    return;
  }

  state.queue.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'track-item' + (idx === 0 ? ' current' : '');

    const info = document.createElement('div');
    info.className = 'track-item-info';
    const name = document.createElement('div');
    name.className = 'track-item-name';
    name.textContent = (idx === 0 ? '♪ ' : '') + item.name;
    const artist = document.createElement('div');
    artist.className = 'track-item-artist';
    artist.textContent = item.artist;
    info.appendChild(name);
    info.appendChild(artist);
    el.appendChild(info);

    if (idx > 0) {
      const playBtn = document.createElement('button');
      playBtn.className = 'track-action';
      playBtn.textContent = '▶';
      playBtn.title = 'Play now';
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await resolveItemUrl(state.queue[idx]);
        const [moved] = state.queue.splice(idx, 1);
        state.queue.unshift(moved);
        playTrack(state.queue[0]);
        renderQueuePanel();
      });
      el.appendChild(playBtn);
    }

    const rmBtn = document.createElement('button');
    rmBtn.className = 'track-action';
    rmBtn.textContent = '×';
    rmBtn.title = idx === 0 ? 'Stop' : 'Remove';
    rmBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      state.queue.splice(idx, 1);
      dom.queueCount.textContent = String(state.queue.length);
      if (idx === 0) {
        if (state.queue.length > 0) {
          await resolveItemUrl(state.queue[0]);
          playTrack(state.queue[0]);
        } else {
          audio.pause();
          audio.src = '';
          state.currentTrack = null;
          state.isPlaying = false;
          dom.playBtn.textContent = '▶';
          dom.onAir.classList.remove('active');
          dom.nowPlaying.textContent = 'Claudio';
          dom.waveform.classList.add('paused');
        }
      }
      renderQueuePanel();
    });
    el.appendChild(rmBtn);

    dom.queuePanel.appendChild(el);
  });
}

// ── favs panel ──
async function renderFavsPanel() {
  dom.favsPanel.innerHTML = '<div class="panel-empty">Loading...</div>';
  try {
    const res = await fetch('/api/favorites');
    const data = await res.json();
    const favs = data.favorites || [];
    dom.favsCount.textContent = String(favs.length);
    dom.favsPanel.innerHTML = '';

    if (favs.length === 0) {
      dom.favsPanel.innerHTML = '<div class="panel-empty">No favorites yet</div>';
      return;
    }

    for (const fav of favs) {
      const el = document.createElement('div');
      el.className = 'track-item';
      const info = document.createElement('div');
      info.className = 'track-item-info';
      const name = document.createElement('div');
      name.className = 'track-item-name';
      name.textContent = fav.song_name;
      const artist = document.createElement('div');
      artist.className = 'track-item-artist';
      artist.textContent = fav.artist;
      info.appendChild(name);
      info.appendChild(artist);
      el.appendChild(info);

      const playBtn = document.createElement('button');
      playBtn.className = 'track-action';
      playBtn.textContent = '▶';
      playBtn.title = 'Play now';
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        playBtn.textContent = '…';
        playBtn.disabled = true;
        try {
          const r = await fetch('/api/play/by-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId: fav.song_id }),
          });
          const item = await r.json();
          if (!item.url) {
            addChatMessage(`无法获取 ${item.name} 的播放链接`, 'system');
            return;
          }
          state.queue.unshift(item);
          setQueue(state.queue);
          playTrack(item);
        } catch (err) {
          addChatMessage(`播放失败: ${err.message}`, 'system');
        } finally {
          playBtn.textContent = '▶';
          playBtn.disabled = false;
        }
      });
      el.appendChild(playBtn);

      const rmBtn = document.createElement('button');
      rmBtn.className = 'track-action';
      rmBtn.textContent = '♥';
      rmBtn.title = 'Remove favorite';
      rmBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch('/api/favorites/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId: fav.song_id, name: fav.song_name, artist: fav.artist }),
        });
        state.lovedSongs.delete(fav.song_id);
        if (state.currentTrack?.songId === fav.song_id) {
          dom.loveBtn.textContent = '♡';
          dom.loveBtn.classList.remove('loved');
        }
        renderFavsPanel();
      });
      el.appendChild(rmBtn);

      dom.favsPanel.appendChild(el);
    }
  } catch {
    dom.favsPanel.innerHTML = '<div class="panel-empty">Failed to load favorites</div>';
  }
}

async function resolveItemUrl(item) {
  if (item.url) return;
  try {
    const endpoint = item.songId ? '/api/play/by-id' : '/api/play/search';
    const body = item.songId ? { songId: item.songId } : { name: item.name };
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const fresh = await r.json();
    if (fresh.url) Object.assign(item, fresh);
  } catch { /* ignore */ }
}

function togglePlay() {
  if (audio.paused && audio.src) {
    audio.play();
  } else if (!audio.paused) {
    audio.pause();
  }
}

function getQueue() { return state.queue; }
function setQueue(items) {
  state.queue = items;
  state._shuffleHistory = [];
  dom.queueCount.textContent = String(items.length);
  refreshQueuePanel();
}

function updateModeDisplay() {
  dom.fmBadge.style.display = state.isFmMode ? '' : 'none';
  dom.smartBadge.style.display = state.isSmartMode ? '' : 'none';
  if (state.isFmMode) {
    dom.playerStatus.textContent = 'FM MODE';
  } else if (state.isSmartMode) {
    dom.playerStatus.textContent = 'SMART';
  } else {
    dom.playerStatus.textContent = 'READY';
  }
  updatePlayModeUI();
}

const PLAY_MODE_LABELS = { list: '\u{1F4CB}', single: '\u{1F501}', shuffle: '\u{1F500}' };
function updatePlayModeUI() {
  const disabled = state.isFmMode || state.isSmartMode;
  dom.playModeBtn.textContent = PLAY_MODE_LABELS[state.playMode] || PLAY_MODE_LABELS.list;
  dom.playModeBtn.classList.toggle('disabled', disabled);
}

function showModeToast(label) {
  let container = document.getElementById('mode-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'mode-toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'mode-toast';
  const close = document.createElement('button');
  close.className = 'mode-toast-close';
  close.textContent = '✕';
  close.addEventListener('click', () => toast.remove());
  toast.textContent = label;
  toast.appendChild(close);
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 3000);
}

let _fetchingFm = false;

async function fetchNextFm() {
  if (_fetchingFm) return;
  _fetchingFm = true;
  try {
    const res = await fetch('/api/play/fm/next', { method: 'POST' });
    if (!res.ok) { state.isFmMode = false; updateModeDisplay(); showModeToast('FM 播放结束'); return; }
    const item = await res.json();
    if (!item || !item.url) { state.isFmMode = false; updateModeDisplay(); showModeToast('FM 播放结束'); return; }
    // Don't play here — WS play handler does it via broadcast.
    // Just update UI so there's no gap before WS arrives.
    state.currentTrack = item;
    dom.nowPlaying.textContent = `${item.name} - ${item.artist}`;
    dom.onAir.classList.add('active');
  } catch {
    state.isFmMode = false;
    updateModeDisplay();
  } finally {
    _fetchingFm = false;
  }
}

async function nextTrack() {
  if (state.isFmMode) {
    await fetchNextFm();
    return;
  }
  if (state.queue.length === 0) return;
  if (!state.isSmartMode && state.playMode === 'single') {
    replayCurrentTrack();
    return;
  }
  if (!state.isSmartMode && state.playMode === 'shuffle' && state.queue.length > 1) {
    state._shuffleHistory.push(state.queue[0]);
    const rndIdx = 1 + Math.floor(Math.random() * (state.queue.length - 1));
    const next = state.queue.splice(rndIdx, 1)[0];
    state.queue.unshift(next);
    await resolveItemUrl(state.queue[0]);
    playTrack(state.queue[0]);
    dom.queueCount.textContent = String(state.queue.length);
    renderQueuePanel();
    return;
  }
  if (state.queue.length > 1) {
    const next = state.queue.shift();
    state.queue.push(next);
    await resolveItemUrl(state.queue[0]);
    playTrack(state.queue[0]);
    dom.queueCount.textContent = String(state.queue.length);
    renderQueuePanel();
  }
}

async function prevTrack() {
  if (state.isFmMode) {
    await fetchNextFm();
    return;
  }
  if (state.queue.length === 0) return;
  if (!state.isSmartMode && state.playMode === 'single') {
    replayCurrentTrack();
    return;
  }
  if (!state.isSmartMode && state.playMode === 'shuffle') {
    if (state._shuffleHistory.length > 0) {
      const prev = state._shuffleHistory.pop();
      const dupIdx = state.queue.findIndex(t => t.songId === prev.songId && t.name === prev.name);
      if (dupIdx >= 0) state.queue.splice(dupIdx, 1);
      state.queue.unshift(prev);
      await resolveItemUrl(state.queue[0]);
      playTrack(state.queue[0]);
      dom.queueCount.textContent = String(state.queue.length);
      renderQueuePanel();
    } else {
      replayCurrentTrack();
    }
    return;
  }
  if (state.queue.length > 1) {
    const prev = state.queue.pop();
    state.queue.unshift(prev);
    await resolveItemUrl(state.queue[0]);
    playTrack(state.queue[0]);
    dom.queueCount.textContent = String(state.queue.length);
    renderQueuePanel();
  }
}

function replayCurrentTrack() {
  if (!state.currentTrack || !state.currentTrack.url) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
  dom.onAir.classList.add('active');
  dom.playBtn.textContent = '⏸';
}

function setPlayMode(mode) {
  state.playMode = mode;
  if (mode !== 'shuffle') state._shuffleHistory = [];
  localStorage.setItem('claudio-playmode', mode);
  updatePlayModeUI();
  dom.playModeDropdown.style.display = 'none';
}

function playTrack(item) {
  if (!item || !item.url) return;
  state.currentTrack = item;
  audio.src = resolveAudioUrl(item.url);
  audio.play().catch(() => {});
  dom.nowPlaying.textContent = `${item.name} - ${item.artist}`;
  dom.onAir.classList.add('active');
  addChatMessage(`🎵 Now playing: ${item.name} — ${item.artist}`, 'system');

  // sync love button
  if (item.songId && state.lovedSongs.has(item.songId)) {
    dom.loveBtn.textContent = '♥';
    dom.loveBtn.classList.add('loved');
  } else {
    dom.loveBtn.textContent = '♡';
    dom.loveBtn.classList.remove('loved');
  }

  // update arc indicator
  if (dom.arcIndicator) {
    const trackIdx = state.queue.findIndex(t => t.songId === item.songId);
    const totalSteps = state._arcSteps || 0;
    if (totalSteps > 1 && trackIdx >= 0) {
      dom.arcIndicator.textContent = `情绪过渡 ${trackIdx + 1}/${Math.min(totalSteps, state.queue.length)}`;
      dom.arcIndicator.style.display = '';
    } else {
      dom.arcIndicator.style.display = 'none';
    }
  }
}

// ── progress bar drag/click ──
const progressContainer = document.querySelector('.progress-container');
if (progressContainer) {
  let dragging = false;

  const seek = (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  };

  progressContainer.addEventListener('mousedown', (e) => {
    dragging = true;
    seek(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    seek(e);
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
  });
}

// ── volume ──
dom.volumeSlider.addEventListener('input', () => {
  state.volume = parseInt(dom.volumeSlider.value);
  audio.volume = state.volume / 100;
  localStorage.setItem('claudio-volume', String(state.volume));
});

// ── chat ──
let lastAiText = '';
function addChatMessage(text, type = 'ai', createdAt) {
  if (type === 'ai' && text === lastAiText) return;
  if (type === 'ai') lastAiText = text;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;

  const inner = document.createElement('div');
  inner.className = 'bubble-content';

  if (type === 'ai') {
    const avatar = document.createElement('div');
    avatar.className = 'bubble-avatar';
    avatar.textContent = '♪';
    inner.appendChild(avatar);
  }

  const textEl = document.createElement('div');
  textEl.className = 'bubble-text';
  textEl.textContent = text;
  inner.appendChild(textEl);

  bubble.appendChild(inner);

  const meta = document.createElement('div');
  meta.className = 'bubble-meta';
  const ts = createdAt ? new Date(createdAt + 'Z') : new Date();
  meta.textContent = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  bubble.appendChild(meta);

  dom.chatMessages.appendChild(bubble);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
}

async function sendChat(text) {
  if (!text.trim()) return;
  addChatMessage(text, 'user');
  dom.chatInput.value = '';

  try {
    const body = { text };
    if (userCoords) {
      body.lat = userCoords.lat;
      body.lon = userCoords.lon;
    }
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.claude && data.say) {
      addChatMessage(data.say, 'ai');
      if (data.segue) {
        addChatMessage(`*${data.segue}*`, 'system');
      }
      if (data.mood) {
        state._currentScene = data.mood.detected || 'chat';
      }
    }
  } catch (err) {
    addChatMessage(`Error: ${err.message}`, 'system');
  }
}

dom.sendBtn.addEventListener('click', () => sendChat(dom.chatInput.value));
dom.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat(dom.chatInput.value);
});

// ── WebSocket ──
let wsReconnectTimer = null;

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/stream`);

  ws.onopen = () => {
    dom.connectionStatus.textContent = 'CONNECTED';
    dom.connectionStatus.className = 'connected';
    if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  };

  ws.onclose = () => {
    dom.connectionStatus.textContent = 'DISCONNECTED';
    dom.connectionStatus.className = 'disconnected';
    wsReconnectTimer = setTimeout(connectWs, 3000);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'play':
          if (msg.payload?.tracks) {
            const becameFm = !!msg.payload.fm && !state.isFmMode;
            const becameSmart = !!msg.payload.smart && !state.isSmartMode;
            state.isFmMode = !!msg.payload.fm;
            state.isSmartMode = !!msg.payload.smart;
            if (!state.isFmMode && !state.isSmartMode) {
              state.isFmMode = false;
              state.isSmartMode = false;
            }
            if (msg.payload.arc) {
              state._arcSteps = msg.payload.arc.steps;
            }
            updateModeDisplay();
            if (becameFm) showModeToast('FM 私人电台');
            if (becameSmart) showModeToast('心动智能模式');
            setQueue(msg.payload.tracks);
            playTrack(msg.payload.tracks[0]);
          }
          break;
        case 'say':
          if (msg.payload?.text) {
            addChatMessage(msg.payload.text, 'ai');
          }
          break;
        case 'token_usage':
          if (msg.payload) {
            const pct = ((msg.payload.input_tokens / msg.payload.context_window) * 100).toFixed(1);
            dom.tokenUsage.textContent = `${(msg.payload.input_tokens / 1000).toFixed(1)}K / ${(msg.payload.context_window / 1000).toFixed(0)}K (${pct}%)`;
          }
          break;
        case 'status':
          if (msg.payload?.isPlaying !== undefined) state.isPlaying = msg.payload.isPlaying;
          break;
        case 'correction':
          if (msg.payload?.say) {
            addChatMessage(msg.payload.say, 'ai');
          }
          break;
        case 'suggestion':
          {
            const s = msg.payload;
            if (!s) break;
            const suggestionsOff = localStorage.getItem('claudio-suggestions') === 'off';
            if (suggestionsOff) break;
            showToast(s);
          }
          break;
      }
    } catch { /* ignore parse errors */ }
  };
}

// ── load history from server ──
async function loadHistory() {
  try {
    const res = await fetch('/api/messages');
    const data = await res.json();
    if (data.messages && data.messages.length > 0) {
      for (const msg of data.messages) {
        const role = msg.role === 'user' ? 'user' : 'ai';
        addChatMessage(msg.content, role, msg.created_at);
      }
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

async function fetchWeather() {
  if (!userCoords) return;
  try {
    const res = await fetch(`/api/weather?lat=${userCoords.lat}&lon=${userCoords.lon}`);
    const data = await res.json();
    if (data.city) {
      dom.onAir.innerHTML = '';
      const dot = document.createElement('span');
      dot.className = 'on-air-dot';
      dom.onAir.appendChild(dot);
      dom.onAir.appendChild(document.createTextNode(`ON AIR  ☼ ${data.city} ${data.temp}°C ${data.description}`));
    }
  } catch { /* ignore */ }
}

async function loadFavorites() {
  try {
    const res = await fetch('/api/favorites');
    const data = await res.json();
    for (const fav of data.favorites || []) {
      state.lovedSongs.add(fav.song_id);
    }
    dom.favsCount.textContent = String(data.favorites?.length || 0);
  } catch { /* ignore */ }
}

let pendingSuggestions = [];

function showToast(s) {
  // Don't show duplicate toasts for same suggestion
  if (pendingSuggestions.some(p => p.id === s.id)) return;

  pendingSuggestions.push(s);
  updateBellBadge();

  const toast = document.createElement('div');
  toast.className = 'toast-card';
  const toastText = document.createElement('span');
  toastText.className = 'toast-text';
  toastText.textContent = s.text;
  const toastActions = document.createElement('div');
  toastActions.className = 'toast-actions';
  const playBtn = document.createElement('button');
  playBtn.className = 'toast-btn play';
  playBtn.dataset.scene = s.scene;
  playBtn.textContent = '播放';
  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'toast-btn dismiss';
  dismissBtn.textContent = '忽略';
  toastActions.appendChild(playBtn);
  toastActions.appendChild(dismissBtn);
  toast.appendChild(toastText);
  toast.appendChild(toastActions);

  const removeSuggestion = () => {
    if (toast.parentNode) toast.remove();
    pendingSuggestions = pendingSuggestions.filter(p => p.id !== s.id);
    updateBellBadge();
  };

  toast.querySelector('.play').addEventListener('click', async () => {
    removeSuggestion();
    const hints = {
      birthday: '来点庆祝的歌', rainy_evening: '来点爵士', late_night: '来点轻柔助眠的',
      morning_commute: '来点提神的', friday_night: '来点放松的', weekend_chill: '来点轻松的',
    };
    dom.chatInput.value = hints[s.scene] || '来点音乐';
    sendChat(dom.chatInput.value);
  });

  toast.querySelector('.dismiss').addEventListener('click', removeSuggestion);

  dom.toastContainer.appendChild(toast);
  setTimeout(removeSuggestion, 30000);
}

function updateBellBadge() {
  const count = pendingSuggestions.length;
  if (count > 0) {
    dom.bellBtn.style.display = '';
    dom.bellBadge.style.display = '';
    dom.bellBadge.textContent = String(count);
  } else {
    dom.bellBtn.style.display = 'none';
    dom.bellBadge.style.display = 'none';
  }
}

// Bell click re-shows latest suggestion
dom.bellBtn?.addEventListener('click', () => {
  const latest = pendingSuggestions[pendingSuggestions.length - 1];
  if (latest) showToast(latest);
});

async function renderStatsPanel() {
  dom.statsPanel.innerHTML = '<div class="panel-empty">Loading...</div>';
  try {
    const listRes = await fetch('/api/stats/list');
    const listData = await listRes.json();
    const periods = listData.periods || [];
    const currentPeriod = periods[0]?.period || new Date().toISOString().slice(0, 7);

    const res = await fetch('/api/stats?period=' + currentPeriod);
    const data = await res.json();

    dom.statsPanel.innerHTML = '';

    // Period selector
    if (periods.length > 1) {
      const sel = document.createElement('select');
      sel.className = 'stats-period-select';
      for (const p of periods) {
        const opt = document.createElement('option');
        opt.value = p.period;
        opt.textContent = p.period;
        opt.selected = p.period === currentPeriod;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', async () => {
        const r = await fetch('/api/stats?period=' + sel.value);
        const d = await r.json();
        renderReportContent(d);
      });
      dom.statsPanel.appendChild(sel);
    }

    if (data.insight) {
      renderReportContent(data);
    } else {
      const empty = document.createElement('div');
      empty.className = 'panel-empty';
      empty.textContent = '暂无报告';
      dom.statsPanel.appendChild(empty);
    }

    // Generate button
    const btn = document.createElement('button');
    btn.className = 'stats-gen-btn';
    btn.textContent = '生成本月报告';
    btn.addEventListener('click', async () => {
      btn.textContent = '生成中…';
      btn.disabled = true;
      try {
        const r = await fetch('/api/stats/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
        const d = await r.json();
        renderReportContent(d);
      } catch { /* ignore */ } finally {
        btn.textContent = '生成本月报告';
        btn.disabled = false;
      }
    });
    dom.statsPanel.appendChild(btn);
  } catch {
    dom.statsPanel.innerHTML = '<div class="panel-empty">加载失败</div>';
  }
}

function renderReportContent(data) {
  // Clear existing report content but keep period selector
  const existing = dom.statsPanel.querySelectorAll('.stats-report');
  existing.forEach(el => el.remove());

  const card = document.createElement('div');
  card.className = 'stats-report';

  const insight = document.createElement('div');
  insight.className = 'stats-insight';
  insight.textContent = data.insight;
  card.appendChild(insight);

  if (data.stat) {
    const detail = document.createElement('div');
    detail.className = 'stats-detail';
    const stat = data.stat;
    const lines = [
      `总播放: ${stat.totalPlays} 次`,
      `最爱歌手: ${(stat.topArtists || []).map(a => a.name).join(', ') || '—'}`,
      `新发现: ${(stat.newDiscoveries || []).map(d => d.name).join(', ') || '—'}`,
    ];
    detail.textContent = lines.join('  ·  ');
    card.appendChild(detail);
  }

  // Insert before generate button
  const genBtn = dom.statsPanel.querySelector('.stats-gen-btn');
  if (genBtn) {
    dom.statsPanel.insertBefore(card, genBtn);
  } else {
    dom.statsPanel.appendChild(card);
  }
}

// ── Playlists ──

let _expandedPlaylistId = null;

async function renderPlaylistsPanel() {
  // Invalidate +LIST cache so next dropdown shows fresh data
  state._playlists = [];

  dom.playlistsPanel.innerHTML = '';

  // Create button bar
  const bar = document.createElement('div');
  bar.className = 'playlist-create-bar';
  const createBtn = document.createElement('button');
  createBtn.className = 'playlist-create-btn';
  createBtn.textContent = '+ 创建歌单';
  createBtn.addEventListener('click', openPlaylistCreateModal);
  bar.appendChild(createBtn);
  dom.playlistsPanel.appendChild(bar);

  if (!state.ncmLoggedIn) {
    const empty = document.createElement('div');
    empty.className = 'panel-empty';
    empty.textContent = '请先登录网易云';
    dom.playlistsPanel.appendChild(empty);
    return;
  }

  try {
    const res = await fetch('/api/ncm/playlists');
    if (!res.ok) { dom.playlistsPanel.innerHTML = '<div class="panel-empty">获取歌单失败</div>'; return; }
    const data = await res.json();
    const playlists = data.playlists || [];

    if (playlists.length === 0) {
      dom.playlistsPanel.innerHTML += '<div class="panel-empty">暂无歌单</div>';
      return;
    }

    for (const pl of playlists) {
      const card = document.createElement('div');
      card.className = 'playlist-card';
      card.dataset.pid = pl.id;

      if (pl.coverImgUrl) {
        const img = document.createElement('img');
        img.className = 'playlist-card-cover';
        img.src = pl.coverImgUrl + '?param=88y88';
        img.alt = '';
        card.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'playlist-card-cover-placeholder';
        placeholder.textContent = '♫';
        card.appendChild(placeholder);
      }

      const info = document.createElement('div');
      info.className = 'playlist-card-info';
      const name = document.createElement('div');
      name.className = 'playlist-card-name';
      name.textContent = pl.name;
      const meta = document.createElement('div');
      meta.className = 'playlist-card-meta';
      meta.textContent = `${pl.trackCount} 首`;
      info.appendChild(name);
      info.appendChild(meta);
      card.appendChild(info);

      card.addEventListener('click', () => showPlaylistDetail(pl.id));
      dom.playlistsPanel.appendChild(card);
    }
  } catch {
    dom.playlistsPanel.innerHTML = '<div class="panel-empty">加载失败</div>';
  }
}

async function showPlaylistDetail(pid) {
  dom.playlistsPanel.innerHTML = '';

  // Back bar
  const bar = document.createElement('div');
  bar.className = 'playlist-detail-bar';
  const backBtn = document.createElement('button');
  backBtn.className = 'playlist-back-btn';
  backBtn.textContent = '← 歌单';
  backBtn.addEventListener('click', renderPlaylistsPanel);
  bar.appendChild(backBtn);
  dom.playlistsPanel.appendChild(bar);

  const container = document.createElement('div');
  container.id = `pl-tracks-${pid}`;
  container.className = 'playlist-tracks';
  container.innerHTML = '<div class="panel-empty" style="padding:24px">加载中...</div>';
  dom.playlistsPanel.appendChild(container);

  try {
    const res = await fetch(`/api/ncm/playlist/${pid}`);
    if (!res.ok) { container.innerHTML = '<div class="panel-empty" style="padding:24px">获取失败</div>'; return; }
    const data = await res.json();
    const tracks = data.tracks || [];
    const pl = data.playlist || {};

    // Playlist header
    const header = document.createElement('div');
    header.className = 'playlist-detail-header';
    if (pl.coverImgUrl) {
      const img = document.createElement('img');
      img.className = 'playlist-detail-cover';
      img.src = pl.coverImgUrl + '?param=256y256';
      img.alt = '';
      header.appendChild(img);
    }
    const headerInfo = document.createElement('div');
    headerInfo.className = 'playlist-detail-info';
    const hName = document.createElement('div');
    hName.className = 'playlist-detail-name';
    hName.textContent = pl.name;
    const hMeta = document.createElement('div');
    hMeta.className = 'playlist-detail-meta';
    hMeta.textContent = `${pl.trackCount} 首`;
    headerInfo.appendChild(hName);
    headerInfo.appendChild(hMeta);
    header.appendChild(headerInfo);
    container.before(header);

    if (tracks.length === 0) {
      container.innerHTML = '<div class="panel-empty" style="padding:24px">歌单为空</div>';
      return;
    }

    container.innerHTML = '';
    for (const t of tracks) {
      const el = document.createElement('div');
      el.className = 'playlist-track-item';

      const info = document.createElement('div');
      info.className = 'playlist-track-info';
      const name = document.createElement('div');
      name.className = 'playlist-track-name';
      name.textContent = t.name;
      const artist = document.createElement('div');
      artist.className = 'playlist-track-artist';
      artist.textContent = t.artist;
      info.appendChild(name);
      info.appendChild(artist);
      el.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'playlist-track-actions';

      const playBtn = document.createElement('button');
      playBtn.className = 'playlist-track-btn';
      playBtn.textContent = '▶';
      playBtn.title = '播放';
      playBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        playBtn.textContent = '…';
        playBtn.disabled = true;
        try {
          const r = await fetch('/api/play/by-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songId: t.id }),
          });
          const item = await r.json();
          if (!item.url) { showModeToast('无法获取播放链接'); return; }
          state.queue.unshift(item);
          setQueue(state.queue);
          playTrack(item);
        } catch { showModeToast('播放失败'); }
        finally { playBtn.textContent = '▶'; playBtn.disabled = false; }
      });
      actions.appendChild(playBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'playlist-track-btn danger';
      delBtn.textContent = '×';
      delBtn.title = '从歌单删除';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const r = await fetch(`/api/ncm/playlist/${pid}/tracks`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackIds: [t.id] }),
          });
          if (!r.ok) { showModeToast('删除失败'); return; }
          showModeToast('已删除');
          el.remove();
          // Update track count in header
          const hMeta = dom.playlistsPanel.querySelector('.playlist-detail-meta');
          if (hMeta) {
            const match = hMeta.textContent.match(/(\d+)/);
            if (match) hMeta.textContent = `${parseInt(match[1]) - 1} 首`;
          }
        } catch { showModeToast('删除失败'); }
      });
      actions.appendChild(delBtn);

      el.appendChild(actions);
      container.appendChild(el);
    }
  } catch {
    container.innerHTML = '<div class="panel-empty" style="padding:12px">加载失败</div>';
  }
}

// ── Add to playlist dropdown ──

dom.addToPlaylistBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const dropdown = dom.addToPlaylistDropdown;
  if (dropdown.style.display !== 'none') { dropdown.style.display = 'none'; return; }

  if (!state.ncmLoggedIn) {
    showModeToast('请先登录网易云');
    return;
  }

  const track = state.currentTrack;
  if (!track || !track.songId) {
    showModeToast('请先播放一首歌');
    return;
  }

  dropdown.innerHTML = '<div class="add-to-playlist-empty">加载中...</div>';
  dropdown.style.display = '';

  // Use cached playlists or fetch fresh
  if (state._playlists.length === 0) {
    try {
      const res = await fetch('/api/ncm/playlists');
      if (!res.ok) { dropdown.innerHTML = '<div class="add-to-playlist-empty">获取失败</div>'; return; }
      const data = await res.json();
      state._playlists = data.playlists || [];
    } catch {
      dropdown.innerHTML = '<div class="add-to-playlist-empty">加载失败</div>';
      return;
    }
  }

  if (state._playlists.length === 0) {
    dropdown.innerHTML = '<div class="add-to-playlist-empty">暂无歌单</div>';
    return;
  }

  dropdown.innerHTML = '';
  for (const pl of state._playlists) {
    const item = document.createElement('div');
    item.className = 'add-to-playlist-item';
    item.textContent = `${pl.name} (${pl.trackCount})`;
    item.addEventListener('click', async () => {
      // First check if song already in playlist (real-time GET)
      try {
        const detailRes = await fetch(`/api/ncm/playlist/${pl.id}`);
        if (detailRes.ok) {
          const detail = await detailRes.json();
          const allTrackIds = detail.allTrackIds ?? [];
          console.log('[add-to-playlist]', { plId: pl.id, songId: track.songId, songIdType: typeof track.songId, allTrackIds, sampleId: allTrackIds[0], sampleType: typeof allTrackIds[0], includes: allTrackIds.includes(Number(track.songId)) });
          if (allTrackIds.includes(Number(track.songId))) {
            showModeToast('已在歌单中');
            dropdown.style.display = 'none';
            return;
          }
        }
      } catch { /* fall through to POST */ }

      try {
        const r = await fetch(`/api/ncm/playlist/${pl.id}/tracks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackIds: [Number(track.songId)] }),
        });
        if (!r.ok) { showModeToast('添加失败'); return; }
        showModeToast(`已添加到「${pl.name}」`);
        pl.trackCount++;
      } catch { showModeToast('添加失败'); }
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(item);
  }
});

// ── Play mode ──
dom.playModeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (state.isFmMode || state.isSmartMode) return;
  const dd = dom.playModeDropdown;
  dd.style.display = dd.style.display !== 'none' ? 'none' : '';
  if (dd.style.display !== 'none') buildPlayModeDropdown();
});

function buildPlayModeDropdown() {
  const dd = dom.playModeDropdown;
  dd.innerHTML = '';
  const modes = [
    { key: 'list', label: '\u{1F4CB} 列表播放' },
    { key: 'single', label: '\u{1F501} 单曲循环' },
    { key: 'shuffle', label: '\u{1F500} 随机播放' },
  ];
  for (const m of modes) {
    const item = document.createElement('div');
    item.className = 'playmode-item';
    if (m.key === state.playMode) item.classList.add('active');
    item.textContent = m.label;
    item.addEventListener('click', () => setPlayMode(m.key));
    dd.appendChild(item);
  }
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (dom.addToPlaylistDropdown && !dom.addToPlaylistBtn.contains(e.target) && !dom.addToPlaylistDropdown.contains(e.target)) {
    dom.addToPlaylistDropdown.style.display = 'none';
  }
  if (dom.playModeDropdown && !dom.playModeBtn.contains(e.target) && !dom.playModeDropdown.contains(e.target)) {
    dom.playModeDropdown.style.display = 'none';
  }
});

// ── Create playlist modal ──

function openPlaylistCreateModal() {
  if (!state.ncmLoggedIn) { showModeToast('请先登录网易云'); return; }
  dom.playlistName.value = '';
  dom.playlistPrivate.checked = false;
  dom.playlistCreateStatus.textContent = '';
  dom.playlistCreateModal.classList.add('open');
  dom.playlistName.focus();
}

function closePlaylistCreateModal() {
  dom.playlistCreateModal.classList.remove('open');
}

dom.playlistCreateClose.addEventListener('click', closePlaylistCreateModal);
dom.playlistCreateCancel.addEventListener('click', closePlaylistCreateModal);
dom.playlistCreateModal.addEventListener('click', (e) => {
  if (e.target._mousedown === dom.playlistCreateModal) closePlaylistCreateModal();
});
dom.playlistCreateModal.addEventListener('mousedown', (e) => {
  e.target._mousedown = e.target;
});

dom.playlistCreateConfirm.addEventListener('click', async () => {
  const name = dom.playlistName.value.trim();
  if (!name) { dom.playlistCreateStatus.textContent = '请输入歌单名称'; dom.playlistCreateStatus.className = 'form-status error'; return; }

  dom.playlistCreateConfirm.disabled = true;
  dom.playlistCreateStatus.textContent = '创建中...';
  dom.playlistCreateStatus.className = 'form-status';

  try {
    const res = await fetch('/api/ncm/playlist/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, privacy: dom.playlistPrivate.checked }),
    });
    const data = await res.json();
    if (!res.ok || !data.playlist) {
      throw new Error(data.error || '创建失败');
    }
    dom.playlistCreateStatus.textContent = `✓ 已创建「${data.playlist.name}」`;
    dom.playlistCreateStatus.className = 'form-status success';
    setTimeout(() => {
      closePlaylistCreateModal();
      renderPlaylistsPanel();
    }, 1000);
  } catch (err) {
    dom.playlistCreateStatus.textContent = `✗ ${err.message}`;
    dom.playlistCreateStatus.className = 'form-status error';
  } finally {
    dom.playlistCreateConfirm.disabled = false;
  }
});

async function init() {
  // Check NCM login status on startup
  try {
    const loginRes = await fetch('/api/ncm/login/status');
    const loginData = await loginRes.json();
    state.ncmLoggedIn = loginData.loggedIn;
    state.ncmVipType = loginData.vipType || 0;
    state.ncmNickname = loginData.nickname || '';
    updateLoginBtn();
  } catch { /* ignore */ }

  await loadFavorites();

  // request geolocation for weather context and suggested queue
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        await fetchWeather();

        // fetch suggested queue on load
        try {
          const params = new URLSearchParams({ lat: String(userCoords.lat), lon: String(userCoords.lon) });
          const r = await fetch('/api/queue/suggested?' + params);
          const data = await r.json();
          if (data.play && data.play.length > 0) {
            addChatMessage(data.say, 'ai');
            state.queue = data.play.map(q => ({ songId: '', name: q, artist: '', url: '' }));
            setQueue(state.queue);
            state._currentScene = data.scene.scene;
            addChatMessage(`📋 场景推荐 (${data.scene.scene}): ${data.reason}`, 'system');
            // resolve first track URL so it's ready when user clicks play
            await resolveItemUrl(state.queue[0]);
            state._pendingPlay = state.queue[0];
            renderQueuePanel();
          }
        } catch { /* ignore */ }
      },
      () => { /* user denied or unavailable */ },
      { timeout: 5000 },
    );
  }

  const hasHistory = await loadHistory();
  if (!hasHistory) {
    addChatMessage('你好！我是 Claudio，你的私人 AI 电台 DJ。想听什么？', 'ai');
  }

  updatePlayModeUI();
  connectWs();

  // deferred play on first user interaction (browser blocks autoplay)
  const firstInteraction = () => {
    if (state._pendingPlay) {
      playTrack(state._pendingPlay);
      state._pendingPlay = null;
    }
    document.removeEventListener('click', firstInteraction);
    document.removeEventListener('keydown', firstInteraction);
  };
  document.addEventListener('click', firstInteraction);
  document.addEventListener('keydown', firstInteraction);
}

init();

// ── NCM Login ──
let qrKey = null;
let qrPollTimer = null;

function updateLoginBtn() {
  if (state.ncmLoggedIn) {
    const vip = state.ncmVipType && state.ncmVipType > 0 ? ' ★VIP' : '';
    dom.ncmLoginBtn.textContent = (state.ncmNickname || 'LOGGED') + vip;
    dom.ncmLoginBtn.classList.add('logged-in');
  } else {
    dom.ncmLoginBtn.textContent = 'LOGIN';
    dom.ncmLoginBtn.classList.remove('logged-in');
  }
}

dom.ncmLoginBtn.addEventListener('click', async () => {
  if (state.ncmLoggedIn) {
    // Logout
    try {
      await fetch('/api/ncm/logout', { method: 'POST' });
    } catch { /* ignore */ }
    state.ncmLoggedIn = false;
    state.ncmVipType = 0;
    state.ncmNickname = '';
    updateLoginBtn();
    addChatMessage('已退出网易云登录', 'system');
    return;
  }
  // Open login modal
  dom.ncmLoginModal.classList.add('open');
  dom.qrImage.style.display = 'none';
  dom.qrPlaceholder.style.display = '';
  dom.qrPlaceholder.textContent = '获取二维码中...';
  dom.qrStatus.textContent = '等待扫码...';
  dom.loginPhone.value = '';
  dom.loginPassword.value = '';
  dom.pwdLoginStatus.textContent = '';
  // Reset to QR tab
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-login-tab="qr"]').classList.add('active');
  document.getElementById('login-qr-panel').style.display = '';
  document.getElementById('login-pwd-panel').style.display = 'none';
  // Start QR flow
  startQrLogin();
});

function closeNcmLogin() {
  dom.ncmLoginModal.classList.remove('open');
  if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
  qrKey = null;
}

dom.ncmLoginClose.addEventListener('click', closeNcmLogin);
dom.ncmLoginModal.addEventListener('mousedown', (e) => {
  e.target._mousedown = e.target;
});
dom.ncmLoginModal.addEventListener('click', (e) => {
  if (e.target === dom.ncmLoginModal && e.target._mousedown === dom.ncmLoginModal) {
    closeNcmLogin();
  }
});

// Login tab switching
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.loginTab;
    document.getElementById('login-qr-panel').style.display = target === 'qr' ? '' : 'none';
    document.getElementById('login-pwd-panel').style.display = target === 'pwd' ? '' : 'none';
    if (target === 'qr') startQrLogin();
  });
});

async function startQrLogin() {
  try {
    // Get QR key
    const keyRes = await fetch('/api/ncm/login/qr/key', { method: 'POST' });
    const keyData = await keyRes.json();
    if (!keyData.data?.unikey) throw new Error('获取二维码 key 失败');
    qrKey = keyData.data.unikey;

    // Get QR image
    const imgRes = await fetch('/api/ncm/login/qr/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: qrKey }),
    });
    const imgData = await imgRes.json();
    if (imgData.data?.qrimg) {
      dom.qrImage.src = imgData.data.qrimg;
      dom.qrImage.style.display = '';
      dom.qrPlaceholder.style.display = 'none';
    } else {
      throw new Error('获取二维码图片失败');
    }

    // Poll for scan status
    dom.qrStatus.textContent = '请使用网易云音乐扫码';
    qrPollTimer = setInterval(async () => {
      if (!qrKey) return;
      try {
        const checkRes = await fetch('/api/ncm/login/qr/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: qrKey }),
        });
        const checkData = await checkRes.json();
        const code = checkData.code || checkData.body?.code;
        if (code === 803) {
          // Success
          if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
          dom.qrStatus.textContent = '✓ 登录成功！';
          dom.qrStatus.className = 'login-status success';
          state.ncmLoggedIn = true;
          updateLoginBtn();
          // Refresh VIP info
          fetch('/api/ncm/login/status').then(r => r.json()).then(d => {
            state.ncmVipType = d.vipType || 0;
            state.ncmNickname = d.nickname || '';
            updateLoginBtn();
          }).catch(() => {});
          addChatMessage('✓ 网易云登录成功', 'system');
          setTimeout(closeNcmLogin, 1500);
        } else if (code === 802) {
          dom.qrStatus.textContent = '✓ 已扫码，请在手机上确认';
          dom.qrStatus.className = 'login-status';
        } else if (code === 801) {
          dom.qrStatus.textContent = '请使用网易云音乐扫码';
          dom.qrStatus.className = 'login-status';
        } else if (code === 800) {
          // Expired
          if (qrPollTimer) { clearInterval(qrPollTimer); qrPollTimer = null; }
          dom.qrStatus.textContent = '二维码已过期，请重新获取';
          dom.qrStatus.className = 'login-status error';
          setTimeout(startQrLogin, 2000);
        }
      } catch { /* retry */ }
    }, 2000);
  } catch (err) {
    dom.qrStatus.textContent = '获取二维码失败: ' + err.message;
    dom.qrStatus.className = 'login-status error';
  }
}

// Password login
dom.pwdLoginBtn.addEventListener('click', async () => {
  const phone = dom.loginPhone.value.trim();
  const password = dom.loginPassword.value.trim();
  if (!phone || !password) {
    dom.pwdLoginStatus.textContent = '请输入手机号和密码';
    dom.pwdLoginStatus.className = 'login-status error';
    return;
  }
  const captchaEl = document.getElementById('login-captcha');
  const captcha = captchaEl ? captchaEl.value.trim() : '';
  dom.pwdLoginStatus.textContent = '登录中...';
  dom.pwdLoginStatus.className = 'login-status';
  dom.pwdLoginBtn.disabled = true;
  try {
    const body = { phone, password };
    if (captcha) body.captcha = captcha;
    const res = await fetch('/api/ncm/login/cellphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.code === 200) {
      dom.pwdLoginStatus.textContent = '✓ 登录成功！';
      dom.pwdLoginStatus.className = 'login-status success';
      state.ncmLoggedIn = true;
      updateLoginBtn();
      fetch('/api/ncm/login/status').then(r => r.json()).then(d => {
        state.ncmVipType = d.vipType || 0;
        state.ncmNickname = d.nickname || '';
        updateLoginBtn();
      }).catch(() => {});
      addChatMessage('✓ 网易云登录成功', 'system');
      setTimeout(closeNcmLogin, 1500);
    } else if (data.code === 462 || data.code === 8821) {
      const captchaSection = document.getElementById('login-captcha-section');
      if (captchaSection) captchaSection.style.display = '';
      dom.pwdLoginStatus.textContent = data.message || '需短信验证码验证';
      dom.pwdLoginStatus.className = 'login-status error';
    } else {
      dom.pwdLoginStatus.textContent = `登录失败: ${data.message || '请检查账号密码'}`;
      dom.pwdLoginStatus.className = 'login-status error';
    }
  } catch (err) {
    dom.pwdLoginStatus.textContent = `连接失败: ${err.message}`;
    dom.pwdLoginStatus.className = 'login-status error';
  } finally {
    dom.pwdLoginBtn.disabled = false;
  }
});

// Send captcha
let captchaCooldown = 0;
document.getElementById('login-send-captcha-btn')?.addEventListener('click', async () => {
  const phone = dom.loginPhone.value.trim();
  if (!phone) {
    const st = document.getElementById('pwd-captcha-status');
    if (st) { st.textContent = '请先输入手机号'; st.className = 'login-status error'; }
    return;
  }
  if (captchaCooldown > 0) return;
  const btn = document.getElementById('login-send-captcha-btn');
  const st = document.getElementById('pwd-captcha-status');
  if (btn) btn.disabled = true;
  if (st) { st.textContent = '发送中...'; st.className = 'login-status'; }
  try {
    const res = await fetch('/api/ncm/login/send-captcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (data.code === 200) {
      if (st) { st.textContent = '✓ 验证码已发送'; st.className = 'login-status success'; }
      captchaCooldown = 60;
      const tick = () => {
        if (captchaCooldown <= 0) { if (btn) { btn.textContent = '发送验证码'; btn.disabled = false; } return; }
        if (btn) btn.textContent = `${captchaCooldown}s`;
        captchaCooldown--;
        setTimeout(tick, 1000);
      };
      tick();
    } else {
      if (st) { st.textContent = `发送失败: ${data.message || '请稍后重试'}`; st.className = 'login-status error'; }
      if (btn) btn.disabled = false;
    }
  } catch (err) {
    const st = document.getElementById('pwd-captcha-status');
    if (st) { st.textContent = `发送失败: ${err.message}`; st.className = 'login-status error'; }
    if (btn) btn.disabled = false;
  }
});

// ── NCM API status polling ──
async function checkNcmStatus() {
  dom.ncmStatus.className = 'ncm-status checking';
  try {
    const res = await fetch('/api/status/ncm');
    const data = await res.json();
    dom.ncmStatus.className = `ncm-status ${data.online ? 'online' : 'offline'}`;
    dom.ncmStatus.title = data.online ? '网易云 API 在线' : `网易云 API 离线: ${data.reason || 'unknown'}`;
  } catch {
    dom.ncmStatus.className = 'ncm-status offline';
    dom.ncmStatus.title = '网易云 API 状态检查失败';
  }
}
checkNcmStatus();
setInterval(checkNcmStatus, 30000);

// ── Settings ──
dom.settingsToggle.addEventListener('click', async () => {
  await loadConfig();
  dom.settingsModal.classList.add('open');
});

function closeSettings() {
  dom.settingsModal.classList.remove('open');
  dom.settingsStatus.textContent = '';
  dom.settingsStatus.className = 'form-status';
}
dom.settingsClose.addEventListener('click', closeSettings);
let settingsMousedownTarget = null;
dom.settingsModal.addEventListener('mousedown', (e) => {
  settingsMousedownTarget = e.target;
});
dom.settingsModal.addEventListener('click', (e) => {
  if (e.target === dom.settingsModal && settingsMousedownTarget === dom.settingsModal) {
    closeSettings();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dom.settingsModal.classList.contains('open')) closeSettings();
  if (e.key === 'Escape' && dom.ncmLoginModal.classList.contains('open')) closeNcmLogin();
});

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    dom.settingsApiKey.value = data.apiKey || '';
    dom.settingsBaseUrl.value = data.baseUrl || 'https://api.anthropic.com';
    dom.settingsApiModel.value = data.apiModel || '';
    dom.settingsNcmApi.value = data.ncmApi || 'http://localhost:3001';
    dom.settingsNcmQuality.value = data.ncmQuality || '';
    dom.settingsWeatherKey.value = data.weatherKey || '';
    dom.settingsFishKey.value = data.fishKey || '';
    dom.settingsFeishuAppId.value = data.feishuAppId || '';
    dom.settingsFeishuAppSecret.value = data.feishuAppSecret || '';
    dom.settingsUpnpDevices.value = data.upnpDevices || '[]';
    // Sync NCM login state
    if (data.ncmLoggedIn !== undefined) {
      state.ncmLoggedIn = data.ncmLoggedIn;
      updateLoginBtn();
    }
  } catch (err) {
    dom.settingsStatus.textContent = `加载失败: ${err.message}`;
    dom.settingsStatus.className = 'form-status error';
  }
}

dom.settingsTest.addEventListener('click', async () => {
  dom.settingsStatus.textContent = '测试中…';
  dom.settingsStatus.className = 'form-status';
  dom.settingsTest.disabled = true;
  try {
    const res = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: dom.settingsApiKey.value,
        baseUrl: dom.settingsBaseUrl.value,
        apiModel: dom.settingsApiModel.value,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      dom.settingsStatus.textContent = `✓ ${data.message}`;
      dom.settingsStatus.className = 'form-status success';
    } else {
      dom.settingsStatus.textContent = `✗ ${data.message}`;
      dom.settingsStatus.className = 'form-status error';
    }
  } catch (err) {
    dom.settingsStatus.textContent = `✗ 错误: ${err.message}`;
    dom.settingsStatus.className = 'form-status error';
  } finally {
    dom.settingsTest.disabled = false;
  }
});

dom.settingsFetchModels.addEventListener('click', async () => {
  // Toggle if already open
  if (dom.modelDropdown.classList.contains('open')) {
    dom.modelDropdown.classList.remove('open');
    return;
  }
  dom.settingsFetchModels.disabled = true;
  dom.settingsFetchModels.textContent = '⋯';
  dom.settingsStatus.textContent = '';
  try {
    const res = await fetch('/api/models');
    const data = await res.json();
    if (data.ok && data.models) {
      dom.modelDropdown.innerHTML = '';
      for (const m of data.models) {
        const item = document.createElement('div');
        item.className = 'model-dropdown-item';
        item.textContent = m;
        item.addEventListener('click', () => {
          dom.settingsApiModel.value = m;
          dom.modelDropdown.classList.remove('open');
        });
        dom.modelDropdown.appendChild(item);
      }
      dom.modelDropdown.classList.add('open');
      dom.settingsStatus.textContent = `✓ ${data.models.length} 个模型`;
      dom.settingsStatus.className = 'form-status success';
    } else {
      dom.settingsStatus.textContent = `✗ ${data.message || '获取失败'}`;
      dom.settingsStatus.className = 'form-status error';
    }
  } catch (err) {
    dom.settingsStatus.textContent = `✗ ${err.message}`;
    dom.settingsStatus.className = 'form-status error';
  } finally {
    dom.settingsFetchModels.disabled = false;
    dom.settingsFetchModels.textContent = '▼';
  }
});
// Close dropdown on click outside
document.addEventListener('click', (e) => {
  if (!e.target || (!dom.modelDropdown.contains(e.target) && !dom.settingsFetchModels.contains(e.target))) {
    dom.modelDropdown.classList.remove('open');
  }
});

dom.settingsSave.addEventListener('click', async () => {
  dom.settingsStatus.textContent = '保存中…';
  dom.settingsStatus.className = 'form-status';
  dom.settingsSave.disabled = true;
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: dom.settingsApiKey.value,
        baseUrl: dom.settingsBaseUrl.value,
        apiModel: dom.settingsApiModel.value,
        ncmApi: dom.settingsNcmApi.value,
        ncmQuality: dom.settingsNcmQuality.value,
        weatherKey: dom.settingsWeatherKey.value,
        fishKey: dom.settingsFishKey.value,
        feishuAppId: dom.settingsFeishuAppId.value,
        feishuAppSecret: dom.settingsFeishuAppSecret.value,
        upnpDevices: dom.settingsUpnpDevices.value,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      dom.settingsStatus.textContent = '✓ 已保存';
      dom.settingsStatus.className = 'form-status success';
    } else {
      throw new Error(data.message || '保存失败');
    }
  } catch (err) {
    dom.settingsStatus.textContent = `✗ ${err.message}`;
    dom.settingsStatus.className = 'form-status error';
  } finally {
    dom.settingsSave.disabled = false;
  }
});
