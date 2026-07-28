import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  isCommoditySiteVariant,
  isSiteVariant,
  resolveSiteVariantFromHostname,
  VALID_VARIANTS,
} from '../src/config/variant-registry';
import {
  COMMODITYNODE_MAP_LAYERS,
  COMMODITYNODE_MOBILE_MAP_LAYERS,
  COMMODITYNODE_PANELS,
} from '../src/config/variants/commoditynode';
import { VARIANT_META } from '../src/config/variant-meta';

describe('CommodityNode additive variant contract', () => {
  it('is registered without replacing the upstream commodity variant', () => {
    assert.equal(isSiteVariant('commoditynode'), true);
    assert.equal(isSiteVariant('commodity'), true);
    assert.ok(VALID_VARIANTS.includes('commoditynode'));
    assert.equal(isCommoditySiteVariant('commoditynode'), true);
    assert.equal(isCommoditySiteVariant('commodity'), true);
  });

  it('resolves only the owned public live hostname', () => {
    assert.equal(resolveSiteVariantFromHostname('live.commoditynode.com'), 'commoditynode');
    assert.equal(resolveSiteVariantFromHostname('LIVE.COMMODITYNODE.COM'), 'commoditynode');
    assert.equal(resolveSiteVariantFromHostname('live.commoditynode.com.evil.example'), null);
    assert.equal(resolveSiteVariantFromHostname('commodity.worldmonitor.app'), 'commodity');
  });

  it('ships only the decision-bearing initial panel set', () => {
    assert.deepEqual(Object.keys(COMMODITYNODE_PANELS), [
      'map',
      'impact-universe',
      'event-pulse',
      'commodities',
      'supply-chain',
      'route-risk',
      'market-implications',
      'monitors',
    ]);

    for (const unrelated of [
      'airline-intel',
      'military-correlation',
      'oref-sirens',
      'world-clock',
      'polymarket',
      'positive-feed',
      'startups',
    ]) {
      assert.equal(COMMODITYNODE_PANELS[unrelated], undefined);
    }
  });

  it('keeps the desktop map analytical and the mobile budget intentionally smaller', () => {
    for (const layer of [
      'miningSites',
      'processingPlants',
      'commodityPorts',
      'commodityEvents',
      'commodityHubs',
      'pipelines',
      'waterways',
      'tradeRoutes',
      'natural',
    ] as const) {
      assert.equal(COMMODITYNODE_MAP_LAYERS[layer], true, `${layer} should be on for desktop`);
    }
    assert.equal(COMMODITYNODE_MOBILE_MAP_LAYERS.commodityEvents, true);

    for (const layer of [
      'processingPlants',
      'pipelines',
      'waterways',
      'tradeRoutes',
      'ais',
      'weather',
      'fires',
      'sanctions',
    ] as const) {
      assert.equal(COMMODITYNODE_MOBILE_MAP_LAYERS[layer], false, `${layer} should be opt-in on mobile`);
    }
  });

  it('uses CommodityNode identity and makes no upstream aggregate usage claims', () => {
    const meta = VARIANT_META.commoditynode;
    assert.equal(meta.siteName, 'CommodityNode');
    assert.equal(meta.url, 'https://commoditynode.com/live/');
    assert.doesNotMatch(meta.description, /\b(?:2M|500\+|190 countries|57 layers)\b/i);
    assert.doesNotMatch(meta.title, /World Monitor/i);
  });

  it('keeps the live surface on an independent Vercel deployment contract', () => {
    const config = JSON.parse(
      readFileSync(new URL('../vercel.commoditynode.json', import.meta.url), 'utf8'),
    ) as {
      buildCommand: string;
      outputDirectory: string;
      rewrites: Array<{ source: string; destination: string }>;
    };
    assert.equal(config.buildCommand, 'npm run build:commoditynode');
    assert.equal(config.outputDirectory, 'dist');
    assert.deepEqual(
      config.rewrites.find((rewrite) => rewrite.source === '/'),
      { source: '/', destination: '/dashboard' },
    );
  });
});
