import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import { buildCommodityNodeEditorialWorkbench } from './build-commoditynode-editorial-workbench.mts';
import {
  transitionCommodityNodeEditorialCandidate,
  type CommodityNodeEditorialCandidate,
  type CommodityNodeEditorialDecision,
  type CommodityNodeEditorialState,
  type CommodityNodeReviewAction,
} from '../shared/commoditynode-editorial-workflow';

const csrf = randomBytes(24).toString('base64url');
const port = Number.parseInt(process.env.COMMODITYNODE_EDITORIAL_PORT ?? '4178', 10);
const initialBuild = await buildCommodityNodeEditorialWorkbench();
const outputDirectory = initialBuild.outputDirectory;
const decisionsDirectory = join(outputDirectory, 'decisions');
await mkdir(decisionsDirectory, { recursive: true });

async function loadStateOverrides(): Promise<Map<string, CommodityNodeEditorialState>> {
  const states = new Map(
    initialBuild.items.map((item) => [item.id, item.state] as const),
  );
  const files = (await readdir(decisionsDirectory))
    .filter((name) => name.endsWith('.json'))
    .sort();
  for (const file of files) {
    try {
      const decision = JSON.parse(
        await readFile(join(decisionsDirectory, file), 'utf8'),
      ) as CommodityNodeEditorialDecision;
      if (states.get(decision.candidateId) === decision.fromState) {
        states.set(decision.candidateId, decision.toState);
      }
    } catch {
      console.warn(`Skipped unreadable editorial decision: ${file}`);
    }
  }
  return states;
}

const stateOverrides = await loadStateOverrides();
const { items } = await buildCommodityNodeEditorialWorkbench(outputDirectory, stateOverrides);
const candidates = new Map<string, CommodityNodeEditorialCandidate>(
  items.map((item) => [item.id, item]),
);

const headers = {
  'cache-control': 'no-store, private',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
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

async function readBody(request: IncomingMessage): Promise<string> {
  return await new Promise((resolveBody, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32_768) reject(new Error('Request body exceeds 32 KiB.'));
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  if (!isLoopback(request)) {
    send(response, 403, 'Loopback access only.');
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  if (request.method === 'GET' && url.pathname === '/') {
    const html = (await readFile(join(outputDirectory, 'index.html'), 'utf8'))
      .replace('__COMMODITYNODE_CSRF__', csrf);
    send(response, 200, html, 'text/html; charset=utf-8');
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/health') {
    send(response, 200, JSON.stringify({ status: 'ok', scope: 'loopback-only' }), 'application/json');
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/review') {
    if (request.headers['x-commoditynode-csrf'] !== csrf) {
      send(response, 403, JSON.stringify({ error: 'Invalid review token.' }), 'application/json');
      return;
    }
    const origin = request.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${port}` && origin !== `http://localhost:${port}`) {
      send(response, 403, JSON.stringify({ error: 'Cross-origin review denied.' }), 'application/json');
      return;
    }
    try {
      const input = JSON.parse(await readBody(request)) as {
        eventId?: string;
        action?: CommodityNodeReviewAction;
        reviewer?: string;
        note?: string;
      };
      const candidate = input.eventId ? candidates.get(input.eventId) : undefined;
      if (!candidate || !input.action) throw new Error('Unknown candidate or action.');
      const decision = transitionCommodityNodeEditorialCandidate(candidate, {
        action: input.action,
        reviewer: input.reviewer ?? '',
        note: input.note ?? '',
        decidedAt: new Date().toISOString(),
      });
      const digest = createHash('sha256')
        .update(JSON.stringify(decision))
        .digest('hex')
        .slice(0, 16);
      const filename = `${decision.decidedAt.replaceAll(':', '-')}-${decision.candidateId}-${digest}.json`;
      await writeFile(join(decisionsDirectory, filename), `${JSON.stringify(decision, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      });
      candidates.set(candidate.id, { ...candidate, state: decision.toState });
      stateOverrides.set(candidate.id, decision.toState);
      await buildCommodityNodeEditorialWorkbench(outputDirectory, stateOverrides);
      send(response, 201, JSON.stringify({ decision, auditFile: filename }), 'application/json');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid review decision.';
      send(response, 400, JSON.stringify({ error: message }), 'application/json');
    }
    return;
  }
  send(response, 404, 'Not found.');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CommodityNode editorial workbench: http://127.0.0.1:${port}`);
  console.log('Loopback only. Review decisions remain under .commoditynode-private/.');
});
