import path from 'node:path';

export function resolveRuntimeFile(fileName: string): string {
  return process.env.CLAUDIO_DATA_DIR ? path.join(process.env.CLAUDIO_DATA_DIR, fileName) : fileName;
}

export function defaultUserCorpusDir(): string {
  return process.env.USER_CORPUS_DIR ?? resolveRuntimeFile('user');
}

export function resolveAppFile(fileName: string): string {
  return path.resolve(process.env.CLAUDIO_RESOURCE_DIR ?? '.', fileName);
}
