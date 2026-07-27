import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMMODITYNODE_AD_ELIGIBLE_POSTS,
  commodityNodeRobotsContent,
  resolveCommodityNodeRoutePolicy,
} from '../shared/commoditynode-route-policy';

describe('CommodityNode route index and advertising policy', () => {
  it('indexes substantive public research and trust routes without ads', () => {
    for (const path of [
      '/',
      '/commodities/',
      '/commodities/copper/',
      '/companies/',
      '/posts/read-commodity-relationship-graph/',
      '/methodology/',
      '/sources/',
      '/authors/commoditynode-editorial/',
    ]) {
      const policy = resolveCommodityNodeRoutePolicy(path);
      assert.equal(policy.indexable, true, path);
      assert.equal(policy.follow, true, path);
      assert.equal(policy.adEligible, false, path);
      assert.match(commodityNodeRobotsContent(policy), /^index, follow/);
    }
  });

  it('keeps internal search, source offer, live app, API and unknown routes out of the index', () => {
    const expectations = new Map([
      ['/search/?q=copper', 'noindex, follow'],
      ['/source/', 'noindex, follow'],
      ['/live/', 'noindex, nofollow'],
      ['/api/health', 'noindex, nofollow'],
      ['/reports/unverified/', 'noindex, nofollow'],
      ['/tools/retired/', 'noindex, nofollow'],
      ['/unreviewed-shell/', 'noindex, nofollow'],
    ]);
    for (const [path, robots] of expectations) {
      const policy = resolveCommodityNodeRoutePolicy(path);
      assert.equal(policy.indexable, false, path);
      assert.equal(policy.adEligible, false, path);
      assert.equal(commodityNodeRobotsContent(policy), robots, path);
    }
  });

  it('fails closed for draft, unevidenced and fixture event/company pages', () => {
    for (const context of [
      { publicationState: 'candidate' as const, evidenceCount: 2, isFixture: false },
      { publicationState: 'published' as const, evidenceCount: 0, isFixture: false },
      { publicationState: 'published' as const, evidenceCount: 2, isFixture: true },
    ]) {
      assert.equal(
        resolveCommodityNodeRoutePolicy('/events/example/', context).indexable,
        false,
      );
      assert.equal(
        resolveCommodityNodeRoutePolicy('/companies/example/', context).indexable,
        false,
      );
    }
    assert.equal(
      resolveCommodityNodeRoutePolicy('/events/example/', {
        publicationState: 'published',
        evidenceCount: 2,
        isFixture: false,
      }).indexable,
      true,
    );
    assert.equal(
      resolveCommodityNodeRoutePolicy('/companies/example/', {
        publicationState: 'published',
        evidenceCount: 2,
        isFixture: false,
      }).indexable,
      true,
    );
  });

  it('requires an explicit manual allowlist before any article can carry ads', () => {
    assert.equal(COMMODITYNODE_AD_ELIGIBLE_POSTS.size, 0);
    assert.equal(
      resolveCommodityNodeRoutePolicy('/posts/commodity-data-needs-two-timestamps/').adEligible,
      false,
    );
  });
});
