import { spawn } from 'node:child_process';

export interface ClaudeOutput {
  say: string;
  play: string[];
  reason: string;
  segue: string;
  error?: boolean;
  raw?: string;
}

export function parseOutput(raw: string): ClaudeOutput {
  // Try to find and parse JSON in the response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        say: parsed.say ?? raw,
        play: parsed.play ?? [],
        reason: parsed.reason ?? '',
        segue: parsed.segue ?? '',
      };
    } catch {
      // invalid JSON inside braces, fall through
    }
  }
  // Plain text response: use as say
  return { say: raw, play: [], reason: '', segue: '' };
}

interface InvokeOptions {
  timeout?: number;
}

export function invokeClaude(
  prompt: string,
  options: InvokeOptions = {},
): Promise<ClaudeOutput> {
  const { timeout = 120000 } = options;

  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt]);

    if (!child || !child.stdout) {
      reject(new Error('Failed to spawn Claude'));
      return;
    }

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    child.stdout.on('data', (data: Buffer) => chunks.push(data));
    child.stderr?.on('data', (data: Buffer) => errChunks.push(data));

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Claude invocation timeout'));
    }, timeout);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      if (code !== 0) {
        const errMsg = Buffer.concat(errChunks).toString();
        reject(new Error(`Claude exited with code ${code}: ${errMsg}`));
        return;
      }
      resolve(parseOutput(Buffer.concat(chunks).toString()));
    });
  });
}
