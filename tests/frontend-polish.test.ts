import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('frontend polish', () => {
  it('defines panel, toast, progress, and loading animations', () => {
    const css = fs.readFileSync(path.resolve('frontend/style.css'), 'utf-8');

    expect(css).toContain('.panel.active');
    expect(css).toContain('transition: opacity .2s, transform .2s');
    expect(css).toContain('@keyframes toastIn');
    expect(css).toContain('@keyframes toastOut');
    expect(css).toContain('.progress-container:hover');
    expect(css).toContain('.typing-dots');
  });

  it('chat module renders a loading state while waiting for the API', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/chat.js'), 'utf-8');

    expect(source).toContain('addLoadingMessage');
    expect(source).toContain('removeLoadingMessage');
    expect(source).toContain('typing-dots');
  });

  it('defines a history tab and panel container', () => {
    const html = fs.readFileSync(path.resolve('frontend/index.html'), 'utf-8');

    expect(html).toContain('data-tab="history"');
    expect(html).toContain('id="history-panel"');
  });

  it('wires the history panel through main and dom modules', () => {
    const domSource = fs.readFileSync(path.resolve('frontend/js/dom.js'), 'utf-8');
    const mainSource = fs.readFileSync(path.resolve('frontend/js/main.js'), 'utf-8');

    expect(domSource).toContain('historyPanel');
    expect(mainSource).toContain("from './history-panel.js'");
    expect(mainSource).toContain("target === 'history'");
    expect(mainSource).toContain('renderHistoryPanel');
  });

  it('history panel implements loading, empty, failure, pagination, and replay states', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/history-panel.js'), 'utf-8');

    expect(source).toContain('/api/history?page=');
    expect(source).toContain('暂无播放记录');
    expect(source).toContain('加载历史失败');
    expect(source).toContain('history-pagination');
    expect(source).toContain('/api/play/by-id');
  });

  it('audio core records history only after the actual play promise resolves', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/audio-core.js'), 'utf-8');

    expect(source).toContain('function recordPlayback(item)');
    expect(source).toContain('let playRequestToken = 0');
    expect(source).toContain('audio.play()');
    expect(source).toContain('.then(() => {');
    expect(source).toContain('recordPlayback(item)');
    const playTrackSource = source.slice(source.indexOf('export function playTrack(item)'), source.indexOf('function updateMediaSession(item)'));
    const helperSource = source.slice(source.indexOf('function recordConfirmedPlayback(item, token, expectedUrl)'), source.indexOf('export function playTrack(item)'));
    expect(playTrackSource).toContain('const audioUrl = resolveAudioUrl(item.url)');
    expect(playTrackSource).toContain('audio.src = audioUrl');
    expect(playTrackSource).toContain('recordConfirmedPlayback(item, token, audio.src)');
    expect(helperSource).toContain('.then(() => {');
    expect(helperSource.indexOf('.then(() => {')).toBeLessThan(helperSource.indexOf('recordPlayback(item)'));
  });

  it('single-repeat replay records history after the actual replay promise resolves', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/audio-core.js'), 'utf-8');
    const helperStart = source.indexOf('function recordConfirmedPlayback(item, token, expectedUrl)');
    const helperEnd = source.indexOf('export function playTrack(item)');
    const helperSource = source.slice(helperStart, helperEnd);
    const replayStart = source.indexOf('function replayCurrentTrack()');
    const replayEnd = source.indexOf('let _fetchingFm = false');
    const replaySource = source.slice(replayStart, replayEnd);

    expect(helperStart).toBeGreaterThanOrEqual(0);
    expect(helperSource).toContain('audio.play()');
    expect(helperSource).toContain('.then(() => {');
    expect(helperSource).toContain('token === playRequestToken');
    expect(helperSource).toContain('state.currentTrack === item');
    expect(helperSource).toContain('audio.src === expectedUrl');
    expect(helperSource).toContain('recordPlayback(item)');
    expect(helperSource.indexOf('.then(() => {')).toBeLessThan(helperSource.indexOf('recordPlayback(item)'));
    expect(replaySource).toContain('const token = ++playRequestToken');
    expect(replaySource).toContain('const audioUrl = audio.src');
    expect(replaySource).toContain('return recordConfirmedPlayback(item, token, audioUrl)');
    expect(replaySource).not.toContain('audio.play().catch(() => {})');
  });

  it('keeps tab panel height stable during async content swaps', () => {
    const css = fs.readFileSync(path.resolve('frontend/style.css'), 'utf-8');

    expect(css).toMatch(/\.panel\s*\{[\s\S]*height:\s*320px;[\s\S]*max-height:\s*320px;/);
    expect(css).toMatch(/@media \(max-height: 720px\)\s*\{[\s\S]*\.panel\s*\{[\s\S]*height:\s*260px;[\s\S]*max-height:\s*260px;/);
  });

  it('stats panel bypasses browser cache when reading reports', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/stats-panel.js'), 'utf-8');

    expect(source).toContain("cache: 'no-store'");
  });

  it('FM next playback uses the shared playTrack path', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/audio-core.js'), 'utf-8');
    const fmStart = source.indexOf('async function fetchNextFm()');
    const fmEnd = source.indexOf('export async function exitMode()');
    const fmSource = source.slice(fmStart, fmEnd);

    expect(fmSource).toContain('playTrack(item)');
    expect(fmSource).not.toContain('state.currentTrack = item');
  });
});
