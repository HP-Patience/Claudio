import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadUserCorpus, assemblePrompt, truncateHistory } from '../src/context.js';
import Database from 'better-sqlite3';
import { initDb } from '../src/db.js';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = 'tests/fixtures/user';

describe('context', () => {
  beforeEach(() => {
    fs.mkdirSync(FIXTURES, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(FIXTURES)) {
      fs.rmSync(FIXTURES, { recursive: true });
    }
  });

  describe('loadUserCorpus', () => {
    it('loads existing taste.md, routines.md, mood-rules.md, playlists.json', () => {
      fs.writeFileSync(path.join(FIXTURES, 'taste.md'), '# My Taste\nI like jazz.');
      fs.writeFileSync(path.join(FIXTURES, 'routines.md'), '# Routines\nWake at 7.');
      fs.writeFileSync(path.join(FIXTURES, 'mood-rules.md'), '# Mood\nMorning = calm.');
      fs.writeFileSync(
        path.join(FIXTURES, 'playlists.json'),
        JSON.stringify({ chill: ['id1', 'id2'] }),
      );

      const corpus = loadUserCorpus(FIXTURES);

      expect(corpus.taste).toContain('I like jazz');
      expect(corpus.routines).toContain('Wake at 7');
      expect(corpus.moodRules).toContain('Morning = calm');
      expect(corpus.playlists).toEqual({ chill: ['id1', 'id2'] });
    });

    it('returns empty strings for missing files, no crash', () => {
      const corpus = loadUserCorpus(FIXTURES);

      expect(corpus.taste).toBe('');
      expect(corpus.routines).toBe('');
      expect(corpus.moodRules).toBe('');
      expect(corpus.playlists).toEqual({});
    });
  });

  describe('assemblePrompt', () => {
    it('includes all 6 prompt modules', () => {
      fs.writeFileSync(path.join(FIXTURES, 'taste.md'), 'taste content');

      const prompt = assemblePrompt({
        userCorpusDir: FIXTURES,
        weather: 'Sunny, 22C',
        calendar: 'Meeting at 10:00',
        time: '2026-06-09 08:00',
        recentHistory: [
          { role: 'user', content: 'play jazz', created_at: '2026-06-09 07:59' },
        ],
      });

      expect(prompt).toContain('taste content');
      expect(prompt).toContain('Sunny, 22C');
      expect(prompt).toContain('Meeting at 10:00');
      expect(prompt).toContain('2026-06-09 08:00');
      expect(prompt).toContain('play jazz');
    });
  });

  describe('truncateHistory', () => {
    it('keeps only the last N items', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        role: 'user',
        content: `msg ${i}`,
        created_at: `2026-06-09 0${i}:00`,
      }));

      const result = truncateHistory(items, 5);
      expect(result).toHaveLength(5);
      expect(result[0].content).toBe('msg 95');
      expect(result[4].content).toBe('msg 99');
    });
  });
});
