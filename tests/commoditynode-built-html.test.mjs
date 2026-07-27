import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const dashboardPath = resolve(import.meta.dirname, '../dist/dashboard.html');

describe('CommodityNode built HTML', () => {
  it('contains only CommodityNode product identity and truthful structured data', (t) => {
    if (!existsSync(dashboardPath)) {
      t.skip('run npm run build:commoditynode before the built-HTML assertion');
      return;
    }

    const html = readFileSync(dashboardPath, 'utf8');
    if (!html.includes("v='commoditynode';document.documentElement.dataset.variant=v;")) {
      t.skip('dist/dashboard.html belongs to a different variant in the shared test job');
      return;
    }
    assert.match(html, /<title>CommodityNode Live - Commodity Impact Intelligence<\/title>/);
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/live\.commoditynode\.com\/" \/>/,
    );
    assert.match(
      html,
      /<link rel="alternate" hreflang="en" href="https:\/\/live\.commoditynode\.com\/" \/>/,
    );
    assert.match(
      html,
      /<link rel="alternate" hreflang="x-default" href="https:\/\/live\.commoditynode\.com\/" \/>/,
    );
    assert.match(
      html,
      /<meta name="robots" content="noindex, follow, max-image-preview:large" \/>/,
    );
    assert.match(html, /<h1 class="app-heading">CommodityNode Live - Commodity Impact Intelligence<\/h1>/);
    assert.match(html, /"codeRepository":\s*"https:\/\/github\.com\/0ssol1620-byte\/commoditynode-worldmonitor"/);
    assert.match(html, /"isBasedOn"/);
    assert.match(html, /The interactive commodity map and live evidence panels run in the browser/);
    assert.match(html, /aria-label="CommodityNode references"/);
    assert.match(html, /<span>CommodityNode<\/span>/);
    assert.match(html, /aria-label="CommodityNode commodity intelligence loading"/);
    assert.match(html, /CommodityNode Live requires JavaScript/);
    assert.match(html, /Corresponding source and build provenance/);
    assert.equal(
      [...html.matchAll(/<meta name="robots"/g)].length,
      1,
      'CommodityNode output must publish one unambiguous robots directive',
    );
    assert.doesNotMatch(html, /Pro Monthly|Pro Annual|2M\+ people|@worldmonitorai/);
    assert.doesNotMatch(html, /"@type":\s*"Organization"[\s\S]*?"name":\s*"World Monitor"/);
    assert.doesNotMatch(
      html,
      /World Monitor’s interactive map|aria-label="World Monitor references"|aria-label="World Monitor dashboard loading"|<span>World Monitor<\/span>/,
    );
  });
});
