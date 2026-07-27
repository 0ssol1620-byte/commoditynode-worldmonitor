import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  buildCommodityNodeWeeklyReview,
  writeCommodityNodeWeeklyReview,
} from '../scripts/build-commoditynode-weekly-review.mts';

const NOW = '2026-07-28T08:00:00.000Z';

describe('CommodityNode weekly quality review', () => {
  it('never invents missing operational or commercial observations', () => {
    const review = buildCommodityNodeWeeklyReview({ now: NOW });
    assert.equal(review.reportingWeek, '2026-07-27');
    assert.equal(review.overallState, 'attention');
    assert.equal(review.dimensions.dataFreshness.state, 'unobserved');
    assert.equal(review.dimensions.corrections.state, 'unobserved');
    assert.equal(review.dimensions.coreWebVitals.state, 'unobserved');
    assert.equal(review.dimensions.contentPerformance.state, 'unobserved');
    assert.equal(review.dimensions.contentPerformance.totals.views, null);
    assert.ok(review.dimensions.sourceRights.reviewRequired > 0);
  });

  it('flags open corrections and poor CWV while preserving observed totals', () => {
    const review = buildCommodityNodeWeeklyReview({
      now: NOW,
      data: {
        corrections: [{
          id: 'COR-2026-001',
          severity: 'critical',
          status: 'open',
          openedAt: '2026-07-27T01:00:00.000Z',
        }],
        coreWebVitals: [{
          route: '/commodities/copper/',
          collectedAt: NOW,
          sampleSize: 120,
          lcpMs: 2_800,
          inpMs: 180,
          cls: 0.05,
        }],
        contentPerformance: [{
          route: '/commodities/copper/',
          collectedAt: NOW,
          views: 50,
          engagedSessions: 31,
          newsletterConversions: 2,
          proConversions: 1,
        }],
      },
    });
    assert.equal(review.overallState, 'attention');
    assert.equal(review.dimensions.corrections.criticalOpen, 1);
    assert.deepEqual(
      review.dimensions.coreWebVitals.failingRoutes,
      ['/commodities/copper/'],
    );
    assert.equal(review.dimensions.contentPerformance.state, 'observed');
    assert.equal(review.dimensions.contentPerformance.totals.views, 50);
  });

  it('writes private JSON and Markdown with explicit unobserved states', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'commoditynode-weekly-review-'));
    try {
      const { review } = await writeCommodityNodeWeeklyReview({
        now: NOW,
        outputDirectory: directory,
      });
      const json = await readFile(join(directory, `${review.reportingWeek}.json`), 'utf8');
      const markdown = await readFile(
        join(directory, `${review.reportingWeek}.md`),
        'utf8',
      );
      assert.match(json, /"state": "unobserved"/);
      assert.match(markdown, /views unobserved/);
      assert.doesNotMatch(`${json}\n${markdown}`, /@|api[_-]?key|secret/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
