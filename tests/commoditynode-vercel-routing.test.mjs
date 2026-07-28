import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const config = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../vercel.json'), 'utf8'),
);

function findRewrite(source, host) {
  return config.rewrites.find(
    (rewrite) =>
      rewrite.source === source
      && rewrite.has?.some((rule) => rule.type === 'host' && rule.value === host),
  );
}

describe('CommodityNode Vercel routing', () => {
  it('serves research at the apex and live intelligence on its subdomain', () => {
    const research = findRewrite('/', '^(?:www\\.)?commoditynode\\.com$');
    const live = findRewrite('/', '^live\\.commoditynode\\.com$');
    assert.equal(research?.destination, '/commoditynode-site/index.html');
    assert.equal(live?.destination, '/dashboard.html');
    assert.ok(config.rewrites.indexOf(research) < config.rewrites.indexOf(live));
  });

  it('routes canonical research assets before the shared SPA catch-all', () => {
    const catchAllIndex = config.rewrites.findIndex((rewrite) =>
      rewrite.source.startsWith('/((?!api|mcp|a2a|ask|oauth|assets|blog|docs'),
    );
    assert.ok(catchAllIndex > 0);
    for (const source of [
      '/posts/:path*',
      '/authors/:path*',
      '/commodities/:path*',
      '/events/:path*',
      '/editorial-policy/:path*',
      '/corrections/:path*',
      '/contact/:path*',
      '/search/:path*',
      '/search-index.json',
      '/methodology/:path*',
      '/sources/:path*',
      '/about/:path*',
      '/privacy/:path*',
      '/brief/:path*',
      '/developers/:path*',
      '/plans/:path*',
      '/rss.xml',
      '/llms.txt',
      '/robots.txt',
      '/sitemap-index.xml',
      '/sitemap-0.xml',
      '/image-sitemap.xml',
      '/_astro/:path*',
      '/images/:path*',
      '/og/:path*',
      '/commoditynode-mark.svg',
    ]) {
      const rewrite = findRewrite(source, '^(?:www\\.)?commoditynode\\.com$');
      assert.ok(rewrite, `${source} CommodityNode rewrite is missing`);
      assert.ok(config.rewrites.indexOf(rewrite) < catchAllIndex);
    }
  });
});
