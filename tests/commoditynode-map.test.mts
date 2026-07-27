import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  adaptMineToCommodityNodeEntity,
  adaptPlantToCommodityNodeEntity,
  adaptPortToCommodityNodeEntity,
  applyCommodityNodeMapPreset,
  COMMODITYNODE_LAYER_GROUPS,
  COMMODITYNODE_MAP_PRESETS,
} from '../src/config/commoditynode-map';
import { COMMODITYNODE_MAP_LAYERS } from '../src/config/variants/commoditynode';
import {
  COMMODITYNODE_VERIFIED_MAP_EVENTS,
  COMMODITY_EVENT_PULSE_DURATION_MS,
  getCommodityEventPulseFrame,
} from '../src/config/commoditynode-map-events';
import { deriveCommodityNodeMapLayerHealth } from '../src/config/commoditynode-map-health';
import {
  COMMODITYNODE_ASSET_CANDIDATES,
  validateCommodityNodeAssetCandidates,
} from '../src/config/commoditynode-asset-registry';

describe('CommodityNode map product contract', () => {
  it('adapts curated assets into explicit discriminated marker records', () => {
    const mine = adaptMineToCommodityNodeEntity({
      id: 'sample-mine',
      name: 'Sample mine',
      lat: 1,
      lon: 2,
      mineral: 'Copper',
      country: 'PA',
      operator: 'Operator',
      status: 'producing',
      significance: 'Test fixture',
    });
    const plant = adaptPlantToCommodityNodeEntity({
      id: 'sample-plant',
      name: 'Sample plant',
      lat: 3,
      lon: 4,
      type: 'smelter',
      mineral: 'Copper',
      country: 'PA',
      operator: 'Operator',
      status: 'operating',
      significance: 'Test fixture',
    });
    const port = adaptPortToCommodityNodeEntity({
      id: 'sample-port',
      name: 'Sample port',
      lat: 5,
      lon: 6,
      country: 'PA',
      city: 'Colón',
      commodities: ['Copper'],
      significance: 'Test fixture',
    });

    assert.equal(mine.kind, 'mine');
    assert.equal(mine.id, 'mine:sample-mine');
    assert.equal(plant.kind, 'processing_plant');
    assert.equal(port.kind, 'commodity_port');
    assert.equal(port.sourceStatus, 'reviewed_registry');
  });

  it('groups every CommodityNode map layer exactly once', () => {
    const groupedLayers = COMMODITYNODE_LAYER_GROUPS.flatMap((group) => [...group.layers]);
    assert.equal(new Set(groupedLayers).size, groupedLayers.length);
    assert.deepEqual(
      [...new Set(groupedLayers)].sort(),
      [
        'commodityHubs',
        'commodityPorts',
        'commodityEvents',
        'miningSites',
        'natural',
        'pipelines',
        'processingPlants',
        'tradeRoutes',
        'waterways',
      ].sort(),
    );
  });

  it('ships deterministic Copper, crude oil, Gold, and Cocoa presets', () => {
    assert.deepEqual(
      COMMODITYNODE_MAP_PRESETS.map((preset) => preset.id),
      ['copper', 'crude-oil', 'gold', 'cocoa'],
    );
    for (const preset of COMMODITYNODE_MAP_PRESETS) {
      const first = applyCommodityNodeMapPreset(COMMODITYNODE_MAP_LAYERS, preset.id);
      const second = applyCommodityNodeMapPreset(COMMODITYNODE_MAP_LAYERS, preset.id);
      assert.deepEqual(first, second);
      assert.equal(first.preset.primaryCommodityId.length > 0, true);
      for (const key of preset.enabledLayers) assert.equal(first.layers[key], true);
    }
    const copper = applyCommodityNodeMapPreset(COMMODITYNODE_MAP_LAYERS, 'copper');
    assert.equal(copper.layers.pipelines, false);
    assert.equal(copper.layers.miningSites, true);
    assert.equal(copper.layers.tradeRoutes, true);
    assert.equal(copper.layers.commodityEvents, true);
  });

  it('publishes only evidence-linked events and settles the ripple after two cycles', () => {
    assert.equal(COMMODITYNODE_VERIFIED_MAP_EVENTS.length, 1);
    const event = COMMODITYNODE_VERIFIED_MAP_EVENTS[0]!;
    assert.equal(event.status, 'published');
    assert.equal(event.sourceStatus, 'verified_historical_event');
    assert.equal(event.evidenceCount, 3);
    assert.equal(event.detailHref, '/events/cobre-panama-production-halt/');

    const first = getCommodityEventPulseFrame(100, 100, false);
    assert.equal(first.active, true);
    assert.equal(first.radiusScale, 0.82);
    const settled = getCommodityEventPulseFrame(
      100 + COMMODITY_EVENT_PULSE_DURATION_MS,
      100,
      false,
    );
    assert.deepEqual(settled, {
      active: false,
      opacity: 0.28,
      radiusScale: 1,
    });
    assert.equal(getCommodityEventPulseFrame(200, 100, true).active, false);
  });

  it('does not collapse partial, stale, and unavailable source states', () => {
    const fresh = {
      name: 'Source A',
      status: 'fresh' as const,
      lastUpdate: new Date('2026-07-28T01:00:00.000Z'),
    };
    const noData = {
      name: 'Source B',
      status: 'no_data' as const,
      lastUpdate: null,
    };
    const stale = {
      name: 'Source C',
      status: 'very_stale' as const,
      lastUpdate: new Date('2026-07-27T01:00:00.000Z'),
    };

    assert.equal(
      deriveCommodityNodeMapLayerHealth('natural', 'webgl', [fresh, noData]).state,
      'partial',
    );
    assert.equal(
      deriveCommodityNodeMapLayerHealth('natural', 'webgl', [stale]).state,
      'stale',
    );
    assert.equal(
      deriveCommodityNodeMapLayerHealth('natural', 'webgl', [noData]).state,
      'unavailable',
    );
    assert.equal(
      deriveCommodityNodeMapLayerHealth('commodityEvents', 'svg').state,
      'historical',
    );
    assert.equal(
      deriveCommodityNodeMapLayerHealth('miningSites', 'svg').state,
      'unavailable',
    );
  });

  it('imports upstream geography into a private candidate registry', () => {
    assert.ok(COMMODITYNODE_ASSET_CANDIDATES.length > 0);
    assert.deepEqual(validateCommodityNodeAssetCandidates(), []);
    assert.equal(
      new Set(COMMODITYNODE_ASSET_CANDIDATES.map((candidate) => candidate.candidateId)).size,
      COMMODITYNODE_ASSET_CANDIDATES.length,
    );
    assert.ok(
      COMMODITYNODE_ASSET_CANDIDATES.every(
        (candidate) =>
          candidate.workflow.status === 'candidate'
          && candidate.workflow.visibility === 'private'
          && candidate.source.importedFrom === 'upstream',
      ),
    );
  });
});
