// Claudio FM — API helpers

export function resolveAudioUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('music.126.net') || u.hostname.endsWith('music.163.com')) {
      return '/api/proxy/audio?url=' + encodeURIComponent(url);
    }
  } catch { /* not a valid URL, pass through */ }
  return url;
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
