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
  tokenUsage: $('#token-usage'),
  themeToggle: $('#theme-toggle'),
  settingsToggle: $('#settings-toggle'),
  settingsModal: $('#settings-modal'),
  settingsClose: $('#settings-close'),
  settingsApiKey: $('#settings-api-key'),
  settingsBaseUrl: $('#settings-base-url'),
  settingsStatus: $('#settings-status'),
  settingsTest: $('#settings-test'),
  settingsSave: $('#settings-save'),
  settingsKeyEye: $('#settings-key-eye'),
  loveBtn: $('#love-btn'),
  hideBtn: $('#hide-btn'),
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
  dom.queueCount.textContent = `${items.length} tracks`;
}

function nextTrack() {
  if (state.queue.length > 1) {
    const next = state.queue.shift();
    state.queue.push(next);
    playTrack(state.queue[0]);
  }
}

function prevTrack() {
  if (state.queue.length > 1) {
    const prev = state.queue.pop();
    state.queue.unshift(prev);
    playTrack(state.queue[0]);
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
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

async function loadFavorites() {
  try {
    const res = await fetch('/api/favorites');
    const data = await res.json();
    for (const fav of data.favorites || []) {
      state.lovedSongs.add(fav.song_id);
    }
  } catch { /* ignore */ }
}

async function init() {
  await loadFavorites();
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
dom.settingsToggle.addEventListener('click', () => {
  loadConfig();
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
  } catch (err) {
    dom.settingsStatus.textContent = `加载失败: ${err.message}`;
    dom.settingsStatus.className = 'form-status error';
  }
}

// Eye toggle for API key
dom.settingsKeyEye.addEventListener('click', () => {
  const input = dom.settingsApiKey;
  if (input.type === 'password') {
    input.type = 'text';
    dom.settingsKeyEye.textContent = '👁‍🗨';
  } else {
    input.type = 'password';
    dom.settingsKeyEye.textContent = '👁';
  }
});

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
      }),
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem('claudio-api-key', dom.settingsApiKey.value);
      localStorage.setItem('claudio-base-url', dom.settingsBaseUrl.value);
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
