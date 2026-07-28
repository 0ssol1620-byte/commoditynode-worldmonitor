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

function findRedirect(source) {
  return config.redirects.find((redirect) => redirect.source === source);
}

describe('CommodityNode Vercel routing', () => {
  it('serves research at the apex and live intelligence on its subdomain', () => {
    const research = findRewrite('/', '^(?:www\\.)?commoditynode\\.com$');
    const live = findRewrite('/', '^live\\.commoditynode\\.com$');
    const fallback = findRewrite('/', '^commoditynode-live\\.vercel\\.app$');
    assert.equal(research?.destination, '/commoditynode-site/index.html');
    assert.equal(live?.destination, '/dashboard.html');
    assert.equal(fallback?.destination, '/dashboard.html');
    assert.ok(config.rewrites.indexOf(research) < config.rewrites.indexOf(live));
    assert.ok(config.rewrites.indexOf(live) < config.rewrites.indexOf(fallback));
  });

  it('does not redirect exact research utility pages into upstream documentation', () => {
    for (const source of ['/about', '/contact', '/privacy']) {
      const redirect = findRedirect(source);
      assert.ok(redirect, `${source} shared redirect is missing`);
      assert.ok(
        redirect.missing?.some(
          (rule) =>
            rule.type === 'host'
            && rule.value === '^(?:www\\.)?commoditynode\\.com$',
        ),
        `${source} must exclude CommodityNode research hosts`,
      );
    }
  });

  it('routes canonical research assets before the shared SPA catch-all', () => {
    const catchAllIndexes = config.rewrites
      .map((rewrite, index) => ({ rewrite, index }))
      .filter(({ rewrite }) =>
        rewrite.source.startsWith('/((?!api|mcp|a2a|ask|oauth|assets|blog|docs'),
      );
    const commodityNodeRetiredIndex = catchAllIndexes.find(
      ({ rewrite }) => rewrite.has?.some(
        (rule) =>
          rule.type === 'host'
          && rule.value === '^(?:www\\.)?commoditynode\\.com$',
      ),
    )?.index ?? -1;
    const sharedSpaIndex = catchAllIndexes.find(
      ({ rewrite }) => !rewrite.has?.some((rule) => rule.type === 'host'),
    )?.index ?? -1;
    assert.ok(commodityNodeRetiredIndex > 0);
    assert.ok(sharedSpaIndex > commodityNodeRetiredIndex);
    assert.equal(
      config.rewrites[commodityNodeRetiredIndex]?.destination,
      '/api/commoditynode-legacy',
    );
    const catchAllIndex = commodityNodeRetiredIndex;
    const pageSources = [
      '/posts/:path*',
      '/authors/:path*',
      '/commodities/:path*',
      '/events/:path*',
      '/companies/:path*',
      '/glossary/:path*',
      '/editorial-policy/:path*',
      '/corrections/:path*',
      '/contact/:path*',
      '/search/:path*',
      '/methodology/:path*',
      '/sources/:path*',
      '/about/:path*',
      '/privacy/:path*',
      '/brief/:path*',
      '/developers/:path*',
      '/plans/:path*',
    ];
    const assetSources = [
      '/search-index.json',
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
    ];
    for (const source of [...pageSources, ...assetSources]) {
      const rewrite = findRewrite(source, '^(?:www\\.)?commoditynode\\.com$');
      assert.ok(rewrite, `${source} CommodityNode rewrite is missing`);
      assert.ok(config.rewrites.indexOf(rewrite) < catchAllIndex);
    }
    for (const source of pageSources) {
      const rewrite = findRewrite(source, '^(?:www\\.)?commoditynode\\.com$');
      assert.ok(
        rewrite.destination.endsWith('/:path*/index.html'),
        `${source} must resolve Astro directory routes to their generated index.html`,
      );
    }
    const canonicalTrailingRoutes = new Map([
      ['/posts/:path*/', '/commoditynode-site/posts/:path*/index.html'],
      ['/authors/:path*/', '/commoditynode-site/authors/:path*/index.html'],
      ['/commodities/', '/commoditynode-site/commodities/index.html'],
      ['/commodities/:path*/', '/commoditynode-site/commodities/:path*/index.html'],
      ['/events/', '/commoditynode-site/events/index.html'],
      ['/events/:path*/', '/commoditynode-site/events/:path*/index.html'],
      ['/companies/', '/commoditynode-site/companies/index.html'],
      ['/companies/:path*/', '/commoditynode-site/companies/:path*/index.html'],
      ['/glossary/', '/commoditynode-site/glossary/index.html'],
      ['/editorial-policy/', '/commoditynode-site/editorial-policy/index.html'],
      ['/corrections/', '/commoditynode-site/corrections/index.html'],
      ['/contact/', '/commoditynode-site/contact/index.html'],
      ['/search/', '/commoditynode-site/search/index.html'],
      ['/methodology/', '/commoditynode-site/methodology/index.html'],
      ['/sources/', '/commoditynode-site/sources/index.html'],
      ['/about/', '/commoditynode-site/about/index.html'],
      ['/privacy/', '/commoditynode-site/privacy/index.html'],
      ['/brief/', '/commoditynode-site/brief/index.html'],
      ['/developers/', '/commoditynode-site/developers/index.html'],
      ['/plans/', '/commoditynode-site/plans/index.html'],
    ]);
    for (const [source, destination] of canonicalTrailingRoutes) {
      const rewrite = findRewrite(source, '^(?:www\\.)?commoditynode\\.com$');
      assert.equal(
        rewrite?.destination,
        destination,
        `${source} must map directly to its generated Astro file`,
      );
      assert.ok(config.rewrites.indexOf(rewrite) < catchAllIndex);
    }
  });

  it('returns 410 for unknown CommodityNode documents before the shared dashboard fallback', () => {
    const catches = config.rewrites.filter((rewrite) =>
      rewrite.source.startsWith('/((?!api|mcp|a2a|ask|oauth|assets|blog|docs'),
    );
    const retired = catches.find((rewrite) =>
      rewrite.has?.some(
        (rule) =>
          rule.type === 'host'
          && rule.value === '^(?:www\\.)?commoditynode\\.com$',
      ),
    );
    const dashboard = catches.find((rewrite) => !rewrite.has);

    assert.equal(retired?.destination, '/api/commoditynode-legacy');
    assert.equal(dashboard?.destination, '/dashboard.html');
    assert.ok(config.rewrites.indexOf(retired) < config.rewrites.indexOf(dashboard));
    assert.match(retired.source, /^\/\(\(\?!api\|mcp\|a2a\|ask\|oauth/);
  });
});
