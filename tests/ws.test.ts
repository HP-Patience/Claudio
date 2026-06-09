import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'node:http';

let wss: WebSocketServer;
let server: http.Server;

async function loadWs() {
  return await import('../src/ws.js');
}

function makeFakeWs(readyState = WebSocket.OPEN) {
  return { readyState, send: vi.fn() } as unknown as WebSocket;
}

describe('ws', () => {
  afterEach(() => {
    wss?.close();
    server?.close();
  });

  it('createWss attaches WebSocketServer to http server', async () => {
    const { createWss } = await loadWs();
    server = http.createServer();
    wss = createWss(server);
    expect(wss).toBeInstanceOf(WebSocketServer);
  });

  it('broadcast sends typed JSON to all open clients', async () => {
    const { createWss, broadcast } = await loadWs();
    server = http.createServer();
    wss = createWss(server);

    const c1 = makeFakeWs();
    wss.clients.add(c1);

    broadcast('now-playing', { song: 'Take Five' });

    const raw = (c1.send as any).mock.calls[0][0];
    expect(JSON.parse(raw)).toEqual({
      type: 'now-playing',
      payload: { song: 'Take Five' },
    });
  });

  it('broadcast skips non-open clients', async () => {
    const { createWss, broadcast } = await loadWs();
    server = http.createServer();
    wss = createWss(server);

    const open = makeFakeWs(WebSocket.OPEN);
    const closed = makeFakeWs(WebSocket.CLOSED);
    wss.clients.add(open);
    wss.clients.add(closed);

    broadcast('ping', {});

    expect(open.send).toHaveBeenCalledOnce();
    expect(closed.send).not.toHaveBeenCalled();
  });

  it('getConnectionCount returns only OPEN clients', async () => {
    const { createWss, getConnectionCount } = await loadWs();
    server = http.createServer();
    wss = createWss(server);

    wss.clients.add(makeFakeWs(WebSocket.OPEN));
    wss.clients.add(makeFakeWs(WebSocket.CLOSED));

    expect(getConnectionCount()).toBe(1);
  });

  it('connection handler tracks new clients', async () => {
    const { createWss, getConnectionCount } = await loadWs();
    server = http.createServer();
    wss = createWss(server);

    const ws = makeFakeWs(WebSocket.OPEN);
    wss.clients.add(ws);

    expect(getConnectionCount()).toBe(1);
  });
});
