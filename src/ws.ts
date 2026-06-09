import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

let wss: WebSocketServer;

export function createWss(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/stream' });
  return wss;
}

export function broadcast(type: string, payload: unknown): void {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

export function getConnectionCount(): number {
  if (!wss) return 0;
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) count++;
  }
  return count;
}
