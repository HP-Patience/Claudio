// Claudio FM — 播放模式切换
import { state } from './state.js';
import { dom } from './dom.js';
import { ICONS } from './icons.js';
import { setPlayMode } from './audio-core.js';

export function buildPlayModeDropdown() {
  const dd = dom.playModeDropdown;
  dd.innerHTML = '';
  const modes = [
    { key: 'list', label: '列表播放' },
    { key: 'single', label: '单曲循环' },
    { key: 'shuffle', label: '随机播放' },
  ];
  for (const m of modes) {
    const item = document.createElement('div');
    item.className = 'playmode-item';
    if (m.key === state.playMode) item.classList.add('active');
    item.innerHTML = (ICONS[m.key] || '') + ' <span>' + m.label + '</span>';
    item.addEventListener('click', () => setPlayMode(m.key));
    dd.appendChild(item);
  }
}

export function init() {
  dom.playModeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.isFmMode || state.isSmartMode) return;
    const dd = dom.playModeDropdown;
    dd.style.display = dd.style.display !== 'none' ? 'none' : '';
    if (dd.style.display !== 'none') buildPlayModeDropdown();
  });
}
