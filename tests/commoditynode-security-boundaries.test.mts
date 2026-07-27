import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, describe, it } from 'node:test';

const savedRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
const savedRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { default: graphHandler } = await import('../api/commoditynode-graph');

after(() => {
  if (savedRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = savedRedisUrl;
  if (savedRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = savedRedisToken;
});

function graphRequest(
  path: string,
  init: RequestInit = {},
): Request {
  return new Request(`https://api.commoditynode.com${path}`, {
    ...init,
    headers: {
      origin: 'https://live.commoditynode.com',
      ...init.headers,
    },
  });
}

describe('CommodityNode public API security boundaries', () => {
  it('serves bounded read-only graph data with defensive headers', async () => {
    const response = await graphHandler(graphRequest('/api/commoditynode-graph?op=snapshot'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://live.commoditynode.com');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('cache-control') ?? '', /stale-while-revalidate/);
  });

  it('rejects hostile origins, mutations, and oversized query inputs', async () => {
    const hostile = await graphHandler(
      new Request('https://api.commoditynode.com/api/commoditynode-graph', {
        headers: { origin: 'https://live.commoditynode.com.evil.example' },
      }),
    );
    assert.equal(hostile.status, 403);

    const mutation = await graphHandler(
      graphRequest('/api/commoditynode-graph', { method: 'POST' }),
    );
    assert.equal(mutation.status, 405);

    const oversized = await graphHandler(
      graphRequest(`/api/commoditynode-graph?op=resolve&q=${'a'.repeat(161)}`),
    );
    assert.equal(oversized.status, 400);
    assert.deepEqual(await oversized.json(), {
      error: 'parameter_too_long',
      parameter: 'q',
    });
  });
});

describe('CommodityNode browser security policy', () => {
  const vercel = JSON.parse(
    readFileSync(resolve(import.meta.dirname, '../vercel.json'), 'utf8'),
  ) as {
    headers: Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
  };
  const value = (source: string, key: string): string | null =>
    vercel.headers
      .find((entry) => entry.source === source)
      ?.headers.find((header) => header.key === key)
      ?.value ?? null;

  it('keeps the app shell anti-framed with a restrictive CSP', () => {
    const source = '/((?!docs|embed|embed\\.html).*)';
    const csp = value(source, 'Content-Security-Policy') ?? '';
    assert.equal(value(source, 'X-Frame-Options'), 'SAMEORIGIN');
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ]) {
      assert.match(csp, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.doesNotMatch(csp, /default-src \*/);
  });

  it('uses a dedicated, script-restricted public embed boundary', () => {
    for (const source of ['/embed', '/embed.html']) {
      const csp = value(source, 'Content-Security-Policy') ?? '';
      assert.equal(value(source, 'X-Frame-Options'), null);
      assert.match(csp, /frame-ancestors \*/);
      assert.match(csp, /script-src 'self'(?:;|$)/);
      assert.match(csp, /object-src 'none'/);
      assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
    }
  });
});
