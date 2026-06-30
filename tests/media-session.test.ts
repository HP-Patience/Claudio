import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Media Session integration', () => {
  it('updates lock-screen metadata and transport action handlers from audio core', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/audio-core.js'), 'utf-8');

    expect(source).toContain('navigator.mediaSession.metadata');
    expect(source).toContain("setActionHandler('play'");
    expect(source).toContain("setActionHandler('pause'");
    expect(source).toContain("setActionHandler('previoustrack'");
    expect(source).toContain("setActionHandler('nexttrack'");
  });
});
