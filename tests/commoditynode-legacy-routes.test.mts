import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import legacyHandler from '../api/commoditynode-legacy';
import {
  COMMODITYNODE_GONE_ROUTE_FAMILIES,
  COMMODITYNODE_LEGACY_REDIRECTS,
  resolveCommodityNodeLegacyDisposition,
} from '../shared/commoditynode-legacy-routes';
import {
  commodityNodeRobotsContent,
  resolveCommodityNodeRoutePolicy,
} from '../shared/commoditynode-route-policy';

const vercel = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', 'vercel.json'), 'utf8'),
) as {
  redirects: Array<{
    source: string;
    destination: string;
    permanent?: boolean;
    has?: Array<{ type: string; value: string }>;
    missing?: Array<{ type: string; value: string }>;
  }>;
  rewrites: Array<{
    source: string;
    destination: string;
    has?: Array<{ type: string; value: string }>;
  }>;
};

const commodityHost = (entry: { has?: Array<{ type: string; value: string }> }) =>
  entry.has?.some(
    (condition) =>
      condition.type === 'host' && new RegExp(condition.value).test('commoditynode.com'),
  ) === true;

describe('CommodityNode legacy route dispositions', () => {
  it('redirects only exact, substantively equivalent legacy records', () => {
    for (const redirect of COMMODITYNODE_LEGACY_REDIRECTS) {
      assert.deepEqual(resolveCommodityNodeLegacyDisposition(redirect.source), {
        state: 'redirect',
        destination: redirect.destination,
        reason: redirect.reason,
      });
      const configured = vercel.redirects.find(
        (entry) => entry.source === redirect.source && commodityHost(entry),
      );
      assert.ok(configured, redirect.source);
      assert.equal(configured.permanent, true);
      assert.equal(
        new URL(configured.destination, 'https://commoditynode.com').pathname,
        redirect.destination,
      );
    }
  });

  it('returns a host-scoped 410 path for every retired route family', () => {
    for (const family of COMMODITYNODE_GONE_ROUTE_FAMILIES) {
      assert.equal(
        resolveCommodityNodeLegacyDisposition(`${family}/unverified-shell`).state,
        'gone',
        family,
      );
      const rewrite = vercel.rewrites.find(
        (entry) =>
          entry.source === `${family}/:path*`
          && entry.destination === '/api/commoditynode-legacy'
          && commodityHost(entry),
      );
      assert.ok(rewrite, family);
      const policy = resolveCommodityNodeRoutePolicy(`${family}/unverified-shell`);
      assert.equal(policy.routeType, 'legacy_gone');
      assert.equal(commodityNodeRobotsContent(policy), 'noindex, nofollow');
      assert.equal(policy.adEligible, false);
    }
  });

  it('keeps upstream pricing and tools redirects from intercepting CommodityNode', () => {
    for (const source of ['/pricing', '/tools', '/tools/:slug([a-z0-9-]+)']) {
      const redirect = vercel.redirects.find(
        (entry) => entry.source === source && !commodityHost(entry),
      );
      assert.ok(redirect?.missing?.some(
        (condition) =>
          condition.type === 'host'
          && new RegExp(condition.value).test('commoditynode.com'),
      ), source);
    }
  });

  it('serves a secure, ad-free Gone response for GET and HEAD only', async () => {
    const response = legacyHandler(
      new Request('https://commoditynode.com/reports/unknown'),
    );
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive, nosnippet');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    const body = await response.text();
    assert.match(body, /no verified successor/i);
    assert.doesNotMatch(body, /adsbygoogle|googlesyndication|analytics|<script/i);

    const head = legacyHandler(
      new Request('https://commoditynode.com/tools/old', { method: 'HEAD' }),
    );
    assert.equal(head.status, 410);
    assert.equal(await head.text(), '');

    const post = legacyHandler(
      new Request('https://commoditynode.com/tools/old', { method: 'POST' }),
    );
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
  });

  it('does not classify unrelated routes as legacy', () => {
    assert.equal(
      resolveCommodityNodeLegacyDisposition('/commodities/copper').state,
      'not_legacy',
    );
  });
});
