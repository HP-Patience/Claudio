import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

function makeMockChild(stdoutData: string, delay = 0) {
  const child = new EventEmitter();
  (child as any).stdout = new EventEmitter();
  (child as any).stderr = new EventEmitter();
  (child as any).kill = vi.fn();

  setTimeout(() => {
    (child as any).stdout.emit('data', Buffer.from(stdoutData));
    (child as any).stdout.emit('end');
    child.emit('close', 0);
  }, delay);

  return child as any;
}

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';
import { invokeClaude, parseOutput } from '../src/claude.js';

describe('parseOutput', () => {
  it('parses valid JSON with all fields', () => {
    const raw = JSON.stringify({
      say: 'Good morning!',
      play: ['id1', 'id2'],
      reason: 'jazz time',
      segue: 'Now playing...',
    });

    const result = parseOutput(raw);
    expect(result.say).toBe('Good morning!');
    expect(result.play).toEqual(['id1', 'id2']);
    expect(result.reason).toBe('jazz time');
    expect(result.segue).toBe('Now playing...');
  });

  it('fills missing fields with defaults', () => {
    const result = parseOutput(JSON.stringify({ say: 'Hello', play: ['id1'] }));
    expect(result.say).toBe('Hello');
    expect(result.play).toEqual(['id1']);
    expect(result.reason).toBe('');
    expect(result.segue).toBe('');
  });

  it('handles empty play array', () => {
    const result = parseOutput(JSON.stringify({ say: 'Hi', play: [] }));
    expect(result.say).toBe('Hi');
    expect(result.play).toEqual([]);
  });

  it('plain text fallback: uses text as say', () => {
    const result = parseOutput('来一首爵士乐放松一下');
    expect(result.say).toBe('来一首爵士乐放松一下');
    expect(result.play).toEqual([]);
  });

  it('extracts JSON from text with surrounding content', () => {
    const raw = 'Here:\n{"say":"hi","play":[],"reason":"","segue":""}\nEnjoy!';
    const result = parseOutput(raw);
    expect(result.say).toBe('hi');
  });
});

describe('invokeClaude', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawns with -p flag and prompt string', async () => {
    const mockChild = makeMockChild(JSON.stringify({ say: 'Hi', play: [] }));
    (spawn as any).mockReturnValue(mockChild);

    await invokeClaude('test prompt');
    expect(spawn).toHaveBeenCalledWith('claude', ['-p', 'test prompt']);
  });

  it('returns parsed ClaudeOutput from stdout', async () => {
    const mockChild = makeMockChild(
      JSON.stringify({ say: 'Hi', play: ['123'], reason: 'test', segue: '' }),
    );
    (spawn as any).mockReturnValue(mockChild);

    const result = await invokeClaude('play jazz');
    expect(result.say).toBe('Hi');
    expect(result.play).toEqual(['123']);
  });

  it('rejects on timeout', async () => {
    const mockChild = makeMockChild('{}', 10000);
    (spawn as any).mockReturnValue(mockChild);

    await expect(invokeClaude('test', { timeout: 50 })).rejects.toThrow('timeout');
  });

  it('rejects on non-zero exit code', async () => {
    const child = new EventEmitter();
    (child as any).stdout = new EventEmitter();
    (child as any).stderr = new EventEmitter();
    (spawn as any).mockReturnValue(child);

    setTimeout(() => {
      (child as any).stderr.emit('data', Buffer.from('Error'));
      (child as any).stdout.emit('end');
      child.emit('close', 1);
    }, 0);

    await expect(invokeClaude('test')).rejects.toThrow('Claude exited with code 1');
  });

  it('handles spawn failure', async () => {
    (spawn as any).mockReturnValue(null);
    await expect(invokeClaude('test')).rejects.toThrow('Failed to spawn Claude');
  });
});
