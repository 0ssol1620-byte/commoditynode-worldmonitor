import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMODITY_ENTITY_TYPES,
  COMMODITY_RELATION_TYPES,
  validateGraphSnapshot,
  validatePublishedImpactEdge,
  type PublishedImpactEdge,
} from '../shared/commodity-impact-ontology';
import {
  COPPER_IMPACT_FIXTURE_EVENT,
  COPPER_IMPACT_FIXTURE_SNAPSHOT,
} from '../src/fixtures/commoditynode-copper-impact';
import { findImpactPaths } from '../src/services/commodity-impact-graph';

describe('CommodityNode impact ontology contract', () => {
  it('matches the masterplan entity and relationship taxonomies', () => {
    assert.equal(COMMODITY_ENTITY_TYPES.length, 22);
    assert.equal(COMMODITY_RELATION_TYPES.length, 22);
    assert.ok(COMMODITY_ENTITY_TYPES.includes('Commodity'));
    assert.ok(COMMODITY_ENTITY_TYPES.includes('Chokepoint'));
    assert.ok(COMMODITY_RELATION_TYPES.includes('passes_through_cost'));
    assert.ok(COMMODITY_RELATION_TYPES.includes('supported_by_claim'));
  });

  it('rejects a published edge with no evidence, reviewer, or conditional rule', () => {
    const invalid = {
      ...COPPER_IMPACT_FIXTURE_SNAPSHOT.edges[0],
      direction: 'conditional',
      condition: '',
      evidenceIds: [],
      reviewedBy: '',
    } satisfies PublishedImpactEdge;
    const issues = validatePublishedImpactEdge(invalid);
    assert.deepEqual(
      issues.map((issue) => issue.path).sort(),
      ['condition', 'evidenceIds', 'reviewedBy'],
    );
  });

  it('validates the disclosed Copper end-to-end fixture', () => {
    assert.equal(COPPER_IMPACT_FIXTURE_EVENT.isFixture, true);
    assert.deepEqual(validateGraphSnapshot(COPPER_IMPACT_FIXTURE_SNAPSHOT), []);
  });

  it('returns deterministic, cycle-free, bounded and explainable paths', () => {
    const paths = findImpactPaths(
      COPPER_IMPACT_FIXTURE_SNAPSHOT,
      COPPER_IMPACT_FIXTURE_EVENT,
      'industry-electrical-equipment',
      { maxHops: 3, now: '2026-07-27T12:00:00Z' },
    );
    assert.equal(paths.length, 1);
    assert.equal(paths[0]?.edgeIds.length, 3);
    assert.equal(new Set(paths[0]?.entityIds).size, 4);
    assert.equal(paths[0]?.relevance, 'exploratory');
    assert.ok(paths[0]?.explanation.some((item) => item.includes('Hop decay')));
    assert.ok(paths[0]?.warnings.includes('Every hop depends on the same evidence record.'));
    assert.ok(paths[0]?.warnings.includes('Demonstration fixture — not a real-world event.'));
  });
});
