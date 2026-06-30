// Claudio FM — 主题切换
import { state } from './state.js';
import { dom } from './dom.js';

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('claudio-theme', theme);
  dom.themeToggle.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
}

export function init() {
  setTheme(state.theme);
  dom.themeToggle.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
}
