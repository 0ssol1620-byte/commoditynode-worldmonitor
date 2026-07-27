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
  });
});
