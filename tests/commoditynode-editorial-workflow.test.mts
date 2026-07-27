import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedCommodityNodeEditorialActions,
  assessCommodityNodeEditorialCandidate,
  transitionCommodityNodeEditorialCandidate,
  type CommodityNodeEditorialCandidate,
} from '../shared/commoditynode-editorial-workflow';

const completeCandidate = (): CommodityNodeEditorialCandidate => ({
  id: 'event-review-test',
  title: 'Reviewed test event',
  state: 'needs_review',
  isFixture: false,
  materiality: 'material',
  occurredAt: '2026-07-28',
  location: {
    id: 'test-location',
    label: 'Reviewed location',
    countryCode: 'PA',
    latitude: 8.8,
    longitude: -80.6,
  },
  entityIds: ['mine-test'],
  claims: [{
    id: 'claim-test',
    text: 'The reviewed operation halted production on the stated date.',
    evidenceIds: ['evidence-test'],
  }],
  evidence: [{
    id: 'evidence-test',
    url: 'https://example.gov/official-record',
    publisher: 'Example authority',
    kind: 'authoritative_primary',
    locator: 'Decision, page 4, paragraph 2.',
  }],
  graphCandidates: [{
    id: 'edge-test',
    sourceEntityId: 'event-test',
    targetEntityId: 'mine-test',
    relationType: 'disrupted_by',
    direction: 'negative',
    condition: null,
    invalidation: 'Re-review if the operating status changes.',
    evidenceIds: ['evidence-test'],
  }],
  unknowns: ['The restart date is not established.'],
  rightsIssues: [],
  reviewedBy: 'Review Editor',
  reviewedAt: '2026-07-28T00:00:00Z',
});

describe('CommodityNode editorial workflow', () => {
  it('approves a fully linked material event', () => {
    const candidate = completeCandidate();
    const assessment = assessCommodityNodeEditorialCandidate(candidate);
    assert.equal(assessment.approvable, true);
    assert.deepEqual(assessment.blockers, []);
    assert.equal(assessment.evidenceCoverage.linkedClaims, 1);

    const decision = transitionCommodityNodeEditorialCandidate(candidate, {
      action: 'approve',
      reviewer: 'Review Editor',
      note: 'Checked the exact locator, entity resolution, and stated uncertainty.',
      decidedAt: '2026-07-28T01:00:00Z',
    });
    assert.equal(decision.fromState, 'needs_review');
    assert.equal(decision.toState, 'approved');
  });

  it('blocks fixtures, missing rights, and unsupported evidence references', () => {
    const candidate = completeCandidate();
    const assessment = assessCommodityNodeEditorialCandidate({
      ...candidate,
      isFixture: true,
      rightsIssues: ['Image license is unresolved.'],
      claims: [{ ...candidate.claims[0]!, evidenceIds: ['missing-evidence'] }],
    });
    assert.equal(assessment.approvable, false);
    assert.ok(assessment.blockers.some((item) => item.includes('Fixture')));
    assert.ok(assessment.blockers.some((item) => item.includes('rights')));
    assert.ok(assessment.blockers.some((item) => item.includes('unknown evidence')));
  });

  it('rejects illegal transitions and empty audit notes', () => {
    const candidate = completeCandidate();
    assert.throws(
      () => transitionCommodityNodeEditorialCandidate(
        { ...candidate, state: 'published' },
        {
          action: 'approve',
          reviewer: 'Review Editor',
          note: 'Reviewed and approved after checking exact records.',
          decidedAt: '2026-07-28T01:00:00Z',
        },
      ),
      /not allowed/,
    );
    assert.throws(
      () => transitionCommodityNodeEditorialCandidate(candidate, {
        action: 'approve',
        reviewer: 'Review Editor',
        note: 'Too short',
        decidedAt: '2026-07-28T01:00:00Z',
      }),
      /decision note/,
    );
  });

  it('exposes only legal actions for each workflow state', () => {
    assert.deepEqual(
      allowedCommodityNodeEditorialActions('needs_sources'),
      ['send_to_editor'],
    );
    assert.deepEqual(
      allowedCommodityNodeEditorialActions('needs_review'),
      ['request_sources', 'request_rights', 'send_to_editor', 'approve'],
    );
    assert.deepEqual(allowedCommodityNodeEditorialActions('retracted'), []);
  });
});
