import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMODITYNODE_SOURCE_CATALOG,
  validateCommodityNodeSourceCatalog,
} from '../shared/commoditynode-source-catalog';

describe('CommodityNode source catalog', () => {
  it('validates the bounded official and filing allowlist', () => {
    assert.doesNotThrow(() => validateCommodityNodeSourceCatalog(COMMODITYNODE_SOURCE_CATALOG));
    assert.equal(COMMODITYNODE_SOURCE_CATALOG.length, 6);
    assert.deepEqual(
      [...new Set(COMMODITYNODE_SOURCE_CATALOG.flatMap((entry) => entry.targetCommodityIds))].sort(),
      ['cocoa', 'copper', 'crude-oil', 'gold'],
    );
  });

  it('keeps raw redistribution disabled and review-required snippets private', () => {
    for (const entry of COMMODITYNODE_SOURCE_CATALOG) {
      assert.equal(entry.rights.fullTextRedistributionAllowed, false);
      assert.ok(entry.collection.maxSummaryCharacters <= 500);
      if (entry.rights.reviewStatus === 'review_required') {
        assert.equal(entry.rights.publicSnippetAllowed, false);
      }
    }
  });

  it('fails closed for aggressive polling and incomplete flagship coverage', () => {
    const first = COMMODITYNODE_SOURCE_CATALOG[0];
    assert.throws(
      () => validateCommodityNodeSourceCatalog([
        {
          ...first,
          collection: { ...first.collection, minimumIntervalSeconds: 1 },
        },
      ]),
      /collection interval is too aggressive|enabled source coverage missing/,
    );
  });
});
