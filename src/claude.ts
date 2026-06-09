import { getPref } from './db.js';
import type Database from 'better-sqlite3';
import https from 'node:https';

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
  db?: Database.Database;
}

export async function invokeClaude(
  prompt: string,
  options: InvokeOptions = {},
): Promise<ClaudeOutput> {
  const { timeout = 120000, db } = options;

  const apiKey = db ? getPref(db, 'api_key') || process.env['ANTHROPIC_API_KEY'] || '' : process.env['ANTHROPIC_API_KEY'] || '';
  const baseUrl = (db ? getPref(db, 'api_base_url') || '' : '') || 'https://api.anthropic.com';

  if (!apiKey) {
    throw new Error('API Key 未配置，请在设置中填写');
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const isAnthropic = cleanBase.includes('anthropic.com');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let text: string;

    if (isAnthropic) {
      // Anthropic Messages API
      const response = await fetch(`${cleanBase}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown error');
        throw new Error(`API ${response.status}: ${errText.slice(0, 300)}`);
      }
      const data = await response.json() as { content: Array<{ type: string; text: string }> };
      text = data.content?.[0]?.text || '';
    } else {
      // OpenAI-compatible API (DeepSeek, etc.) — use https.request for reliability
      text = await new Promise<string>((resolve, reject) => {
        const body = JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });
        const u = new URL(`${cleanBase}/v1/chat/completions`);
        const req = https.request({
          hostname: u.hostname,
          port: 443,
          path: u.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'Content-Length': Buffer.byteLength(body),
          },
          timeout,
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const parsed = JSON.parse(data);
                resolve(parsed.choices?.[0]?.message?.content || '');
              } catch { reject(new Error('JSON parse error')); }
            } else {
              reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
            }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('API 请求超时')); });
        req.write(body);
        req.end();
      });
      clearTimeout(timer);
    }

    return parseOutput(text);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('API 请求超时');
    }
    throw err;
  }
}
