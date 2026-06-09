// Claudio FM — 前端交互逻辑

// ── 状态 ──
const state = {
  theme: localStorage.getItem('claudio-theme') || 'dark',
  isPlaying: false,
  currentTrack: null,
  volume: parseInt(localStorage.getItem('claudio-volume') || '80'),
  queue: [],
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
  queueCount: $('#queue-count'),
  themeToggle: $('#theme-toggle'),
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
    dom.progress.style.width = `${pct}%`;
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
}

// ── progress bar click ──
const progressContainer = document.querySelector('.progress-container');
if (progressContainer) {
  progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
    }
  });
}

// ── volume ──
dom.volumeSlider.addEventListener('input', () => {
  state.volume = parseInt(dom.volumeSlider.value);
  audio.volume = state.volume / 100;
  localStorage.setItem('claudio-volume', String(state.volume));
});

// ── chat ──
function addChatMessage(text, type = 'ai') {
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
  const now = new Date();
  meta.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
        case 'status':
          if (msg.payload?.isPlaying !== undefined) state.isPlaying = msg.payload.isPlaying;
          break;
      }
    } catch { /* ignore parse errors */ }
  };
}

connectWs();

// ── welcome message ──
addChatMessage('你好！我是 Claudio，你的私人 AI 电台 DJ。想听什么？', 'ai');
