import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    console.warn('[AppError]', err.code, err.message);
    res.status(err.status).json({ ok: false, code: err.code, message: err.message, detail: err.detail ?? null });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error('[unhandled error]', err);
  res.status(500).json({ ok: false, code: 'UNEXPECTED', message, detail: null });
}
