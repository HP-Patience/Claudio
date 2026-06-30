import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('scene suggestion settings', () => {
  it('settings UI includes a scene recommendation toggle', () => {
    const html = fs.readFileSync(path.resolve('frontend/index.html'), 'utf-8');
    expect(html).toContain('settings-scene-suggestions-enabled');
    expect(html).toContain('场景推荐');
  });

  it('settings module loads and saves scene recommendation toggle', () => {
    const source = fs.readFileSync(path.resolve('frontend/js/settings.js'), 'utf-8');
    expect(source).toContain('sceneSuggestionsEnabled');
    expect(source).toContain('settingsSceneSuggestionsEnabled');
  });
});
