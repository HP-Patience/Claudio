import net from 'node:net';

function canListen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(preferred: number): Promise<number> {
  const candidates = [preferred, ...Array.from({ length: 100 }, (_, i) => preferred + i + 1)];
  for (const port of candidates) {
    if (port === 3000) continue;
    if (await canListen(port)) return port;
  }
  throw new Error(`No available port near ${preferred}`);
}
