import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

interface TtsOptions {
  cacheDir: string;
  apiKey?: string;
}

export function getCachePath(text: string, cacheDir: string): string {
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  return path.join(cacheDir, `${hash}.mp3`);
}

export function ensureCacheDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export async function synthesize(
  text: string,
  options: TtsOptions,
): Promise<string | null> {
  const cachePath = getCachePath(text, options.cacheDir);
  ensureCacheDir(options.cacheDir);

  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  const apiKey = options.apiKey ?? process.env.FISH_AUDIO_API_KEY;
  try {
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(cachePath, buffer);
    return cachePath;
  } catch {
    return null;
  }
}
