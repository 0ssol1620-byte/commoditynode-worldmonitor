import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const researchRoot = resolve(root, 'public/commoditynode-site');
const read = (path) => readFileSync(resolve(researchRoot, path), 'utf8');

describe('CommodityNode research build', () => {
  it('publishes an indexable, product-specific research surface', (t) => {
    if (!existsSync(resolve(researchRoot, 'index.html'))) {
      t.skip('run npm run build:commoditynode before the research-build assertion');
      return;
    }

    const html = read('index.html');
    assert.match(html, /<html lang="en" data-site="commoditynode">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/commoditynode\.com\/">/);
    assert.match(
      html,
      /<link rel="alternate" hreflang="en" href="https:\/\/commoditynode\.com\/">/,
    );
    assert.match(
      html,
      /<link rel="alternate" hreflang="x-default" href="https:\/\/commoditynode\.com\/">/,
    );
    assert.match(html, /Trace commodity shocks from source event to market exposure\./);
    assert.match(html, /data-live-map-teaser/);
    assert.match(
      html,
      /data-src="https:\/\/live\.commoditynode\.com\/embed\?[^"]*variant=commoditynode/,
    );
    assert.doesNotMatch(
      html,
      /<iframe[^>]+\ssrc="https:\/\/live\.commoditynode\.com\//,
      'the live application must not load during the research page initial render',
    );
    assert.match(html, /IntersectionObserver/);
    assert.doesNotMatch(html, /adsbygoogle|pagead2\.googlesyndication/);
    assert.match(html, /href="https:\/\/live\.commoditynode\.com"/);
    assert.match(html, /id="main-content"/);
    assert.match(html, /data-commoditynode-privacy/);
    assert.match(html, /data-open-privacy-settings/);
    assert.match(html, /commoditynode:consent:v1/);
    assert.match(html, /\/api\/commoditynode-analytics/);
    assert.doesNotMatch(html, /@worldmonitorai|abacus\.worldmonitor|>WORLD MONITOR<|>World Monitor</);

    const searchHtml = read('search/index.html');
    assert.match(searchHtml, /<meta name="robots" content="noindex, follow/);
    assert.doesNotMatch(searchHtml, /hreflang=/);
  });

  it('keeps only CommodityNode research in discovery files', (t) => {
    if (!existsSync(resolve(researchRoot, 'sitemap-0.xml'))) {
      t.skip('run npm run build:commoditynode before the research-build assertion');
      return;
    }

    const sitemap = read('sitemap-0.xml');
    const robots = read('robots.txt');
    const llms = read('llms.txt');
    assert.match(sitemap, /https:\/\/commoditynode\.com\/methodology\//);
    assert.match(sitemap, /https:\/\/commoditynode\.com\/commodities\/copper\//);
    assert.match(sitemap, /https:\/\/commoditynode\.com\/companies\/first-quantum-minerals\//);
    assert.match(sitemap, /https:\/\/commoditynode\.com\/editorial-policy\//);
    assert.match(sitemap, /https:\/\/commoditynode\.com\/authors\/commoditynode-editorial\//);
    assert.match(sitemap, /commodity-data-needs-two-timestamps/);
    assert.doesNotMatch(sitemap, /glossary|authors\/elie-habib|\/search\/|worldmonitor/);
    assert.match(robots, /Sitemap: https:\/\/commoditynode\.com\/sitemap-index\.xml/);
    assert.match(llms, /^# CommodityNode Research/m);
    assert.doesNotMatch(llms, /World Monitor Blog|worldmonitor\.app/);
  });

  it('ships local fonts and restrained visual CSS', (t) => {
    const assets = resolve(researchRoot, '_astro');
    if (!existsSync(assets)) {
      t.skip('run npm run build:commoditynode before the research-build assertion');
      return;
    }

    const files = readdirSync(assets);
    const css = files
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFileSync(resolve(assets, file), 'utf8'))
      .join('\n');
    assert.ok(files.some((file) => file.includes('source-sans-3') && file.endsWith('.woff2')));
    assert.ok(files.some((file) => file.includes('ibm-plex-mono') && file.endsWith('.woff2')));
    assert.doesNotMatch(css, /backdrop-filter|transition:\s*all|linear-gradient/);
    assert.doesNotMatch(css, /url\(\.\/files\//);
  });

  it('publishes substantive trust pages and three original articles', (t) => {
    if (!existsSync(researchRoot)) {
      t.skip('run npm run build:commoditynode before the research-build assertion');
      return;
    }

    for (const page of [
      'methodology',
      'sources',
      'editorial-policy',
      'corrections',
      'contact',
      'search',
      'about',
      'privacy',
      'authors/commoditynode-editorial',
    ]) {
      assert.ok(existsSync(resolve(researchRoot, page, 'index.html')), `${page} page is missing`);
    }
    const searchIndex = JSON.parse(read('search-index.json'));
    assert.equal(searchIndex.version, 1);
    assert.equal(searchIndex.records.filter((record) => record.type === 'commodity').length, 4);
    assert.equal(searchIndex.records.filter((record) => record.type === 'research').length, 3);
    assert.deepEqual(
      searchIndex.records
        .filter((record) => record.type === 'company')
        .map((record) => record.id),
      ['company:first-quantum-minerals'],
    );
    assert.equal(searchIndex.records.some((record) => /fixture/i.test(record.title)), false);
    for (const commodity of ['copper', 'crude-oil', 'gold', 'cocoa']) {
      const html = read(`commodities/${commodity}/index.html`);
      assert.match(html, /Benchmark contract/i);
      assert.match(html, /Source register/i);
      assert.match(html, /"@type":"Dataset"/);
    }
    const companyHtml = read('companies/first-quantum-minerals/index.html');
    assert.match(companyHtml, /Documented exposure mechanisms/);
    assert.match(companyHtml, /What this record does not establish/);
    assert.match(companyHtml, /Punta Rincón port/);
    assert.match(companyHtml, /"@type":"Organization"/);
    assert.match(companyHtml, /<meta name="robots" content="index, follow/);
    assert.doesNotMatch(companyHtml, /adsbygoogle|pagead2\.googlesyndication/);
    const posts = readdirSync(resolve(researchRoot, 'posts'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    assert.equal(posts.length, 3);
    for (const post of posts) {
      const html = read(`posts/${post.name}/index.html`);
      assert.match(html, /CommodityNode Editorial/);
      assert.match(html, /<meta name="robots" content="index, follow/);
      assert.match(html, /"author":\{"@type":"Organization"/);
      assert.match(html, /Reviewed by CommodityNode Editorial/);
      assert.match(html, /src="\/blog\/images\/blog\//);
      assert.doesNotMatch(html, /adsbygoogle|pagead2\.googlesyndication|data-ad-slot/);
      assert.doesNotMatch(html, /data-commoditynode-ad-slot/);
    }
    const searchHtml = read('search/index.html');
    assert.match(searchHtml, /<meta name="robots" content="noindex, follow"/);
    const authorHtml = read('authors/commoditynode-editorial/index.html');
    assert.match(authorHtml, /It does not represent a fabricated person/);
    assert.match(authorHtml, /"@type":"ProfilePage"/);
  });
});
