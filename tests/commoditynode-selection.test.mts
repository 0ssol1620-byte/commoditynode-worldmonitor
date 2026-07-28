import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getCommodityNodeSearchCatalog,
  resolveCommodityNodeSelection,
} from '../src/config/commoditynode-selection';

describe('CommodityNode map selection contract', () => {
  it('indexes every required search category with unique governed identifiers', () => {
    const catalog = getCommodityNodeSearchCatalog();
    assert.deepEqual(Object.keys(catalog).sort(), [
      'commodity',
      'commoditycompany',
      'commodityevent',
      'commodityfacility',
      'commodityroute',
    ]);
    for (const items of Object.values(catalog)) {
      assert.ok(items.length > 0);
    }
    const selections = Object.values(catalog).flat();
    assert.equal(
      new Set(selections.map((item) => item.id)).size,
      selections.length,
    );
  });

  it('resolves raw map marker identifiers into full drawer records', () => {
    const mine = resolveCommodityNodeSelection(
      'cobre-panama',
      'mining-sites-layer',
    );
    assert.equal(mine?.entityId, 'mine:cobre-panama');
    assert.equal(mine?.commodityId, 'copper');
    assert.equal(mine?.researchHref, '/commodities/copper/');
    assert.equal(mine?.eventHref, '/events/cobre-panama-production-halt/');
    assert.match(mine?.sourceLabel ?? '', /not live telemetry/i);

    const route = resolveCommodityNodeSelection(
      'gulf-europe-oil',
      'trade-routes-layer',
    );
    assert.equal(route?.kind, 'route');
    assert.equal(route?.layerId, 'tradeRoutes');
    assert.equal(typeof route?.latitude, 'number');
    assert.equal(typeof route?.longitude, 'number');
    assert.equal(route?.alertScope, undefined);

    const event = resolveCommodityNodeSelection(
      'event-cobre-panama-halt-2023',
      'commodity-events-layer',
    );
    assert.equal(event?.kind, 'event');
    assert.equal(event?.layerId, 'commodityEvents');
    assert.equal(event?.sourceStatus, 'verified_historical_event');
    assert.equal(event?.eventHref, '/events/cobre-panama-production-halt/');
    assert.deepEqual(event?.alertScope, {
      scopeType: 'event_pulse',
      scopeId: 'cobre-panama-production-halt',
    });
  });

  it('keeps unpublished commodity research links on the real catalog', () => {
    const catalog = getCommodityNodeSearchCatalog();
    const silver = catalog.commodity.find((item) => item.id === 'commodity:silver');
    const gold = catalog.commodity.find((item) => item.id === 'commodity:gold');
    assert.equal(silver?.data.researchHref, '/commodities/');
    assert.equal(gold?.data.researchHref, '/commodities/gold/');
    for (const item of Object.values(catalog).flat()) {
      assert.match(item.data.researchHref, /^\/commodities\//);
      if (item.data.eventHref) {
        assert.match(item.data.eventHref, /^\/events\//);
      }
    }
  });
});
