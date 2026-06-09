// Claudio FM — 前端交互逻辑

// ── 状态 ──
const state = {
  theme: localStorage.getItem('claudio-theme') || 'dark',
  isPlaying: false,
  currentTrack: null,
  volume: parseInt(localStorage.getItem('claudio-volume') || '80'),
  queue: [],
  lovedSongs: new Set(),
};

let userCoords = null; // { lat, lon } from geolocation

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
  chatPanel: $('#chat-panel'),
  arcIndicator: $('#arc-indicator'),
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
      body: JSON.stringify({ songId: track.songId, name: track.name, artist: track.artist }),
    });
  } catch { /* ignore */ }

  if (state.queue.length > 1) {
    nextTrack();
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
    if (target === 'queue') renderQueuePanel();
    if (target === 'favs') renderFavsPanel();
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
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
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
    rmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.queue.splice(idx, 1);
      dom.queueCount.textContent = String(state.queue.length);
      if (idx === 0) {
        if (state.queue.length > 0) {
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

function nextTrack() {
  if (state.queue.length > 1) {
    const next = state.queue.shift();
    state.queue.push(next);
    playTrack(state.queue[0]);
    dom.queueCount.textContent = String(state.queue.length);
    renderQueuePanel();
  }
}

function prevTrack() {
  if (state.queue.length > 1) {
    const prev = state.queue.pop();
    state.queue.unshift(prev);
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

async function init() {
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
}

init();

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
