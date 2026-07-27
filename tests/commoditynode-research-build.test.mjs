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
    assert.match(html, /Trace commodity shocks from source event to market exposure\./);
    assert.match(html, /href="https:\/\/live\.commoditynode\.com"/);
    assert.match(html, /id="main-content"/);
    assert.doesNotMatch(html, /@worldmonitorai|abacus\.worldmonitor|>WORLD MONITOR<|>World Monitor</);
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
    assert.match(sitemap, /commodity-data-needs-two-timestamps/);
    assert.doesNotMatch(sitemap, /glossary|authors|worldmonitor/);
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

    for (const page of ['methodology', 'sources', 'about', 'privacy']) {
      assert.ok(existsSync(resolve(researchRoot, page, 'index.html')), `${page} page is missing`);
    }
    const posts = readdirSync(resolve(researchRoot, 'posts'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    assert.equal(posts.length, 3);
    for (const post of posts) {
      const html = read(`posts/${post.name}/index.html`);
      assert.match(html, /CommodityNode Editorial Desk/);
      assert.match(html, /<meta name="robots" content="index, follow/);
    }
  });
});
