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
};

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
  settingsNcmApi: $('#settings-ncm-api'),
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
  nextTrack();
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
    if (target === 'queue') renderQueuePanel();
    if (target === 'favs') renderFavsPanel();
    if (target === 'stats') renderStatsPanel();
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
  dom.queueCount.textContent = String(items.length);
  refreshQueuePanel();
}

async function nextTrack() {
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
  if (state.queue.length > 1) {
    const prev = state.queue.pop();
    state.queue.unshift(prev);
    await resolveItemUrl(state.queue[0]);
    playTrack(state.queue[0]);
    dom.queueCount.textContent = String(state.queue.length);
    renderQueuePanel();
  }
}

function playTrack(item) {
  if (!item || !item.url) return;
  state.currentTrack = item;
  audio.src = item.url;
  audio.play();
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
            if (msg.payload.arc) {
              state._arcSteps = msg.payload.arc.steps;
            }
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

async function init() {
  // Check NCM login status on startup
  try {
    const loginRes = await fetch('/api/ncm/login/status');
    const loginData = await loginRes.json();
    state.ncmLoggedIn = loginData.loggedIn;
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
  dom.ncmLoginBtn.textContent = state.ncmLoggedIn ? 'LOGOUT' : 'LOGIN';
  dom.ncmLoginBtn.classList.toggle('logged-in', state.ncmLoggedIn);
}

dom.ncmLoginBtn.addEventListener('click', async () => {
  if (state.ncmLoggedIn) {
    // Logout
    try {
      await fetch('/api/ncm/logout', { method: 'POST' });
    } catch { /* ignore */ }
    state.ncmLoggedIn = false;
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
      dom.qrImage.src = 'data:image/png;base64,' + imgData.data.qrimg;
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
  dom.pwdLoginStatus.textContent = '登录中...';
  dom.pwdLoginStatus.className = 'login-status';
  dom.pwdLoginBtn.disabled = true;
  try {
    const res = await fetch('/api/ncm/login/cellphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (data.code === 200) {
      dom.pwdLoginStatus.textContent = '✓ 登录成功！';
      dom.pwdLoginStatus.className = 'login-status success';
      state.ncmLoggedIn = true;
      updateLoginBtn();
      addChatMessage('✓ 网易云登录成功', 'system');
      setTimeout(closeNcmLogin, 1500);
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
    dom.settingsNcmApi.value = data.ncmApi || 'http://localhost:3001';
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
        ncmApi: dom.settingsNcmApi.value,
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
