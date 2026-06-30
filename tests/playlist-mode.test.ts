import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('playlist internal playback mode', () => {
  it('keeps playlist playback separate from the external queue', () => {
    const stateSource = fs.readFileSync(path.resolve('frontend/js/state.js'), 'utf-8');
    const audioSource = fs.readFileSync(path.resolve('frontend/js/audio-core.js'), 'utf-8');

    expect(stateSource).toContain('isPlaylistMode: false');
    expect(stateSource).toContain('playlistQueue: []');
    expect(audioSource).toContain('export async function enterPlaylistMode');
    expect(audioSource).toContain('export function exitPlaylistMode');
    expect(audioSource).toContain('state.playlistQueue');
    expect(audioSource).toContain('const queue = getPlaybackQueue();');
    expect(audioSource).toContain('const shuffleHistory = getShuffleHistory();');
    expect(audioSource).not.toContain('setQueue(state.playlistQueue)');
  });

  it('adds a playlist detail button for internal playlist playback', () => {
    const panelSource = fs.readFileSync(path.resolve('frontend/js/playlists-panel.js'), 'utf-8');

    expect(panelSource).toContain('enterPlaylistMode');
    expect(panelSource).toContain('exitPlaylistMode');
    expect(panelSource).toContain('playlist-mode-btn');
    expect(panelSource).toContain('歌单内播放');
  });

  it('styles the playlist mode button and clears playlist mode for streamed play payloads', () => {
    const css = fs.readFileSync(path.resolve('frontend/style.css'), 'utf-8');
    const wsSource = fs.readFileSync(path.resolve('frontend/js/ws.js'), 'utf-8');

    expect(css).toContain('.playlist-mode-btn');
    expect(css).toContain('.playlist-mode-btn.active');
    expect(wsSource).toContain('exitPlaylistMode({ silent: true })');
  });
});
