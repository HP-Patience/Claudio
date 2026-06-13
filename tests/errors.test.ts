import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { AppError, errorMiddleware } from '../src/errors.js';

describe('AppError', () => {
  it('creates error with code, message, status, and detail', () => {
    const err = new AppError('CLAUDIO_ERR_TEST', 'test message', 400, 'extra info');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CLAUDIO_ERR_TEST');
    expect(err.message).toBe('test message');
    expect(err.status).toBe(400);
    expect(err.detail).toBe('extra info');
  });

  it('defaults status to 500 and detail to undefined', () => {
    const err = new AppError('CLAUDIO_ERR_TEST', 'msg');
    expect(err.status).toBe(500);
    expect(err.detail).toBeUndefined();
  });
});

describe('errorMiddleware', () => {
  function createApp() {
    const app = express();
    // Test route that throws AppError
    app.get('/test-app-error', () => {
      throw new AppError('CLAUDIO_ERR_TEST', 'something failed', 400, 'detail');
    });
    // Test route that throws plain Error
    app.get('/test-plain-error', () => {
      throw new Error('plain error');
    });
    // Normal route that succeeds
    app.get('/ok', (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorMiddleware);
    return app;
  }

  it('returns structured error for AppError', async () => {
    const app = createApp();
    const res = await request(app).get('/test-app-error');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      code: 'CLAUDIO_ERR_TEST',
      message: 'something failed',
      detail: 'detail',
    });
  });

  it('returns UNEXPECTED for plain Error', async () => {
    const app = createApp();
    const res = await request(app).get('/test-plain-error');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      ok: false,
      code: 'UNEXPECTED',
      message: 'plain error',
      detail: null,
    });
  });

  it('passes through successful requests', async () => {
    const app = createApp();
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
