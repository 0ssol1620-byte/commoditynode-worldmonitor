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
    assert.match(html, /<title>CommodityNode Live - Commodity Impact Intelligence<\/title>/);
    assert.match(html, /<h1 class="app-heading">CommodityNode Live - Commodity Impact Intelligence<\/h1>/);
    assert.match(html, /"codeRepository":\s*"https:\/\/github\.com\/0ssol1620-byte\/commoditynode-worldmonitor"/);
    assert.match(html, /"isBasedOn"/);
    assert.match(html, /CommodityNode’s interactive map, panels, alerts, and live analysis/);
    assert.match(html, /aria-label="CommodityNode references"/);
    assert.match(html, /<span>CommodityNode<\/span>/);
    assert.doesNotMatch(html, /Pro Monthly|Pro Annual|2M\+ people|@worldmonitorai/);
    assert.doesNotMatch(html, /"@type":\s*"Organization"[\s\S]*?"name":\s*"World Monitor"/);
    assert.doesNotMatch(html, /World Monitor’s interactive map|aria-label="World Monitor references"|<span>World Monitor<\/span>/);
  });
});
