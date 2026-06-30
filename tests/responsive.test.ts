import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';

let server: http.Server;
let baseUrl: string;
let browser: Browser;
let page: Page;

describe('responsive frontend layout', () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.static(path.resolve('frontend')));
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('server failed to start');
    baseUrl = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  });

  afterAll(async () => {
    await page?.close();
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('uses full-screen touch layout on phone-sized viewport', async () => {
    await page.goto(baseUrl);

    const appBox = await page.locator('#app').boundingBox();
    expect(appBox?.width).toBeGreaterThanOrEqual(389);

    const appStyles = await page.locator('#app').evaluate((el) => {
      const styles = getComputedStyle(el);
      return { borderRadius: styles.borderRadius, borderWidth: styles.borderWidth };
    });
    expect(appStyles.borderRadius).toBe('0px');
    expect(appStyles.borderWidth).toBe('0px');

    const hiddenStyles = await page.evaluate(() => ({
      transportLeft: getComputedStyle(document.querySelector('.transport-left')!).display,
      volume: getComputedStyle(document.querySelector('#volume')!).display,
    }));
    expect(hiddenStyles.transportLeft).toBe('none');
    expect(hiddenStyles.volume).toBe('none');

    const inputBox = await page.locator('#chat-input').boundingBox();
    const sendBox = await page.locator('#send-btn').boundingBox();
    expect(inputBox?.height).toBeGreaterThanOrEqual(48);
    expect(sendBox?.width).toBeGreaterThanOrEqual(44);
    expect(sendBox?.height).toBeGreaterThanOrEqual(44);
  });
});
