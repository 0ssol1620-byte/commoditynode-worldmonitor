import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCommodityNodeHealthSnapshot,
  createCommodityNodePublicStatusBadge,
  validateCommodityNodeProviderObservation,
} from '../shared/commoditynode-data-health';
import { COMMODITYNODE_DATA_SOURCES } from '../shared/commoditynode-data-source-registry';

const NOW = '2026-07-28T06:00:00Z';
const sourceIds = new Set(COMMODITYNODE_DATA_SOURCES.map((source) => source.id));

describe('CommodityNode private data health and public status badges', () => {
  it('fails closed when no provider observations are supplied', () => {
    const snapshot = buildCommodityNodeHealthSnapshot({
      sources: COMMODITYNODE_DATA_SOURCES,
      observations: [],
      now: NOW,
    });
    assert.equal(snapshot.state, 'unobserved');
    assert.equal(snapshot.counts.unobserved, COMMODITYNODE_DATA_SOURCES.length);
    assert.equal(snapshot.counts.current, 0);
    assert.deepEqual(createCommodityNodePublicStatusBadge(snapshot.sources), {
      state: 'unobserved',
      label: 'Status unavailable',
      description: 'Current source status is not available. No freshness claim is made.',
    });
  });

  it('classifies provider state against cadence-specific freshness budgets', () => {
    const observations = [
      {
        sourceId: 'eia',
        checkedAt: NOW,
        lastSuccessAt: '2026-07-28T05:58:00Z',
        state: 'healthy',
        latencyMs: 184,
        detail: 'Latest approved series request completed.',
      },
      {
        sourceId: 'usgs-nmic',
        checkedAt: NOW,
        lastSuccessAt: '2025-01-01T00:00:00Z',
        state: 'healthy',
        latencyMs: 320,
        detail: 'Catalog transport succeeded but the last material snapshot is old.',
      },
    ] as const;
    const snapshot = buildCommodityNodeHealthSnapshot({
      sources: COMMODITYNODE_DATA_SOURCES,
      observations,
      now: NOW,
    });
    assert.equal(
      snapshot.sources.find((source) => source.sourceId === 'eia')?.publicState,
      'current',
    );
    assert.equal(
      snapshot.sources.find((source) => source.sourceId === 'usgs-nmic')?.publicState,
      'unavailable',
    );
    assert.equal(snapshot.state, 'unavailable');
  });

  it('does not expose operator detail through the public badge contract', () => {
    const snapshot = buildCommodityNodeHealthSnapshot({
      sources: COMMODITYNODE_DATA_SOURCES,
      observations: [{
        sourceId: 'eia',
        checkedAt: NOW,
        lastSuccessAt: null,
        state: 'failed',
        latencyMs: null,
        detail: 'Secret upstream diagnostic detail.',
      }],
      now: NOW,
    });
    const badge = createCommodityNodePublicStatusBadge(
      snapshot.sources.filter((source) => source.sourceId === 'eia'),
    );
    assert.equal(badge.state, 'unavailable');
    assert.doesNotMatch(JSON.stringify(badge), /Secret upstream/);
  });

  it('rejects unknown sources and impossible observation timestamps', () => {
    assert.throws(
      () => validateCommodityNodeProviderObservation({
        sourceId: 'unknown',
        checkedAt: NOW,
        lastSuccessAt: null,
        state: 'failed',
        latencyMs: null,
        detail: 'Unknown provider.',
      }, sourceIds),
      /unknown source/,
    );
    assert.throws(
      () => validateCommodityNodeProviderObservation({
        sourceId: 'eia',
        checkedAt: NOW,
        lastSuccessAt: '2026-07-28T07:00:00Z',
        state: 'healthy',
        latencyMs: 10,
        detail: 'Timestamp error.',
      }, sourceIds),
      /must not follow checkedAt/,
    );
  });
});
