import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const source = JSON.parse(
  readFileSync(resolve(root, 'shared/commoditynode-design-tokens.json'), 'utf8'),
);
const spaCss = readFileSync(
  resolve(root, 'src/styles/commoditynode-tokens.generated.css'),
  'utf8',
);
const researchCss = readFileSync(
  resolve(root, 'blog-site/src/styles/commoditynode-tokens.generated.css'),
  'utf8',
);

describe('CommodityNode design-token contract', () => {
  it('keeps both application surfaces on one generated token artifact', () => {
    assert.equal(spaCss, researchCss);
    assert.equal(source.product, 'CommodityNode');
  });

  it('keeps editorial and aligned-data typography roles separate', () => {
    assert.match(source.typography.ui, /Source Sans 3/);
    assert.match(source.typography.data, /IBM Plex Mono/);
    assert.doesNotMatch(source.typography.ui, /Mono/);
  });

  it('defines semantic color tiers without decorative effects', () => {
    for (const theme of ['dark', 'light']) {
      assert.ok(source.color[theme].signal);
      assert.ok(source.color[theme].signalMuted);
      assert.ok(source.color[theme].danger);
      assert.ok(source.color[theme].text);
    }
    assert.doesNotMatch(spaCss, /transition:\s*all|backdrop-filter|linear-gradient/);
  });
});
