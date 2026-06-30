// Claudio FM — 时钟
import { dom } from './dom.js';

export function updateClock() {
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

export function init() {
  updateClock();
  setInterval(updateClock, 1000);
}
