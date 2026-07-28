import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMODITYNODE_DEPENDENCIES,
  simulateCommodityNodeOutage,
} from '../shared/commoditynode-resilience';

describe('CommodityNode outage simulations', () => {
  for (const dependency of COMMODITYNODE_DEPENDENCIES) {
    it(`fails soft when ${dependency} is unavailable`, () => {
      const simulation = simulateCommodityNodeOutage({
        scenario: `${dependency} unavailable`,
        failedDependencies: [dependency],
        verifiedGraphSnapshotAvailable: dependency === 'database',
      });
      assert.equal(simulation.overallState, 'degraded');
      assert.equal(
        simulation.surfaces.find((surface) => surface.id === 'research')?.state,
        'current',
      );
      assert.ok(simulation.surfaces.some((surface) => surface.state !== 'current'));
      assert.ok(Object.values(simulation.invariants).every(Boolean));
    });
  }

  it('never serves an unverified graph snapshot during a database outage', () => {
    const simulation = simulateCommodityNodeOutage({
      scenario: 'database unavailable without snapshot',
      failedDependencies: ['database'],
      verifiedGraphSnapshotAvailable: false,
    });
    const graph = simulation.surfaces.find((surface) => surface.id === 'impact-universe');
    assert.equal(graph?.state, 'unavailable');
    assert.match(graph?.response ?? '', /no verified snapshot/i);
  });

  it('keeps AI advisory-only and media failures accessible', () => {
    const simulation = simulateCommodityNodeOutage({
      scenario: 'AI and image pipeline unavailable',
      failedDependencies: ['ai', 'image-pipeline'],
    });
    assert.match(
      simulation.surfaces.find((surface) => surface.id === 'editorial')?.response ?? '',
      /human review/i,
    );
    assert.match(
      simulation.surfaces.find((surface) => surface.id === 'media')?.response ?? '',
      /accessible text fallback/i,
    );
  });
});
