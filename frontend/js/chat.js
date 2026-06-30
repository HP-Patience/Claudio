// Claudio FM — 聊天模块
import { state, userCoords } from './state.js';
import { dom } from './dom.js';

let lastAiText = '';

export function addChatMessage(text, type = 'ai', createdAt) {
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

export function addLoadingMessage() {
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai loading';
  bubble.innerHTML = '<div class="bubble-content"><div class="bubble-avatar">♪</div><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  dom.chatMessages.appendChild(bubble);
  dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  return bubble;
}

export function removeLoadingMessage(bubble) {
  if (bubble?.parentNode) bubble.remove();
}

export async function sendChat(text) {
  if (!text.trim()) return;
  addChatMessage(text, 'user');
  dom.chatInput.value = '';
  const loading = addLoadingMessage();

  try {
    const body = { text };
    if (userCoords.lat != null && userCoords.lon != null) {
      body.lat = userCoords.lat;
      body.lon = userCoords.lon;
    }
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.say) {
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
  } finally {
    removeLoadingMessage(loading);
  }
}

export function init() {
  dom.sendBtn.addEventListener('click', () => sendChat(dom.chatInput.value));
  dom.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat(dom.chatInput.value);
  });
}
