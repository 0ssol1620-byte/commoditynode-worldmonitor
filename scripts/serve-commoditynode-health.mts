import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';

import { buildCommodityNodeHealthDashboard } from './build-commoditynode-health-dashboard.mts';

const port = Number.parseInt(process.env.COMMODITYNODE_HEALTH_PORT ?? '4179', 10);
const { outputDirectory } = await buildCommodityNodeHealthDashboard();

const headers = {
  'cache-control': 'no-store, private',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
};

function send(
  response: ServerResponse,
  status: number,
  body: string,
  contentType = 'text/plain; charset=utf-8',
): void {
  response.writeHead(status, { ...headers, 'content-type': contentType });
  response.end(body);
}

function isLoopback(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress ?? '';
  const host = (request.headers.host ?? '').split(':')[0]?.replace(/^\[|\]$/g, '');
  return (
    (address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1')
    && (host === '127.0.0.1' || host === 'localhost' || host === '::1')
  );
}

const server = createServer(async (request, response) => {
  if (!isLoopback(request)) {
    send(response, 403, 'Loopback access only.');
    return;
  }
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  if (request.method === 'GET' && url.pathname === '/') {
    send(
      response,
      200,
      await readFile(resolve(outputDirectory, 'index.html'), 'utf8'),
      'text/html; charset=utf-8',
    );
    return;
  }
  if (request.method === 'GET' && url.pathname === '/snapshot.json') {
    send(
      response,
      200,
      await readFile(resolve(outputDirectory, 'snapshot.json'), 'utf8'),
      'application/json; charset=utf-8',
    );
    return;
  }
  send(response, 404, 'Not found.');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CommodityNode data health: http://127.0.0.1:${port}`);
  console.log('Loopback only. Operator detail remains under .commoditynode-private/.');
});
