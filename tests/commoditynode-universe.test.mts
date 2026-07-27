import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  COMMODITY_UNIVERSE_EDGES,
  COMMODITY_UNIVERSE_NODES,
  getCommodityUniverseEdgesForNode,
  getCommodityUniverseNodeIdForLabel,
  validateCommodityUniverseModel,
} from '../src/config/commoditynode-universe';
import {
  COBRE_PANAMA_PLAYBACK_SNAPSHOTS,
  COBRE_PANAMA_TIMELINE,
} from '../shared/commoditynode-cobre-panama-impact';

const sharedCommodities = JSON.parse(
  readFileSync(new URL('../shared/commodities.json', import.meta.url), 'utf8'),
) as { commodities: Array<{ symbol: string }> };

describe('CommodityNode Impact Universe contract', () => {
  it('includes every tracked commodity instrument and excludes macro/FX instruments', () => {
    const expected = sharedCommodities.commodities
      .map((item) => item.symbol)
      .filter((symbol) => symbol !== '^VIX' && !symbol.endsWith('=X'))
      .sort();
    const actual = COMMODITY_UNIVERSE_NODES.map((node) => node.symbol).sort();

    assert.deepEqual(actual, expected);
    assert.equal(actual.length, 23);
  });

  it('uses a valid deterministic graph with named, typed relationships', () => {
    assert.deepEqual(validateCommodityUniverseModel(), []);
    assert.ok(COMMODITY_UNIVERSE_EDGES.length >= 15);
    for (const edge of COMMODITY_UNIVERSE_EDGES) {
      assert.ok(edge.label.length >= 8);
      assert.notEqual(edge.source, edge.target);
    }
  });

  it('does not privilege Gold as the universe root', () => {
    assert.equal(COMMODITY_UNIVERSE_NODES[0]?.id, 'gold');
    assert.notEqual(COMMODITY_UNIVERSE_NODES[0]?.x, 500);
    assert.notEqual(COMMODITY_UNIVERSE_NODES[0]?.y, 310);
    assert.ok(getCommodityUniverseEdgesForNode('copper').length > 0);
    assert.ok(getCommodityUniverseEdgesForNode('wti').length > 0);
    assert.ok(getCommodityUniverseEdgesForNode('wheat').length > 0);
  });

  it('resolves map-layer mineral labels into universe selections', () => {
    assert.equal(getCommodityUniverseNodeIdForLabel('Copper'), 'copper');
    assert.equal(getCommodityUniverseNodeIdForLabel('Aluminium'), 'aluminum');
    assert.equal(getCommodityUniverseNodeIdForLabel('Cobalt'), null);
  });

  it('builds deterministic cumulative evidence playback without implying a live archive', () => {
    assert.equal(COBRE_PANAMA_PLAYBACK_SNAPSHOTS.length, COBRE_PANAMA_TIMELINE.length);
    assert.deepEqual(
      COBRE_PANAMA_PLAYBACK_SNAPSHOTS.map((snapshot) => snapshot.date),
      COBRE_PANAMA_TIMELINE.map((entry) => entry.date),
    );
    for (const [index, snapshot] of COBRE_PANAMA_PLAYBACK_SNAPSHOTS.entries()) {
      assert.equal(snapshot.reconstruction, true);
      if (index > 0) {
        const previous = COBRE_PANAMA_PLAYBACK_SNAPSHOTS[index - 1];
        assert.ok(previous);
        assert.ok(snapshot.evidenceIds.length >= previous.evidenceIds.length);
        for (const evidenceId of previous.evidenceIds) {
          assert.ok(snapshot.evidenceIds.includes(evidenceId));
        }
      }
    }
  });

  it('keeps the WebGL renderer progressive and context-loss safe', () => {
    const source = readFileSync(
      new URL('../src/components/commodity-universe-webgl.ts', import.meta.url),
      'utf8',
    );
    assert.match(source, /getContext\('webgl2'/);
    assert.match(source, /powerPreference: 'low-power'/);
    assert.match(source, /webglcontextlost/);
    assert.match(source, /ResizeObserver/);
    assert.match(source, /Math\.min\(2, window\.devicePixelRatio/);
  });
});
