import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalizeCommodityEventUrl,
  commodityEventFingerprint,
  evaluateCommodityEventPublication,
  normalizeCommodityEventTitle,
} from '../shared/commoditynode-event-pulse.ts';

const primaryEvidence = {
  id: 'court',
  url: 'https://www.organojudicial.gob.pa/noticias/case',
  publisher: 'Judicial Branch of Panama',
  kind: 'authoritative_primary' as const,
  locator: 'Decision and publication date.',
  supportsClaims: ['decision'],
};

describe('CommodityNode Event Pulse contract', () => {
  it('normalizes titles and strips tracking parameters from canonical URLs', () => {
    assert.equal(normalizeCommodityEventTitle('  Cobre—Panamá:  HALT! '), 'cobre panamá halt');
    assert.equal(
      canonicalizeCommodityEventUrl('https://EXAMPLE.com//events/halt/?utm_source=test&b=2&a=1#claim'),
      'https://example.com/events/halt?a=1&b=2',
    );
  });

  it('creates a stable event fingerprint independent of entity and commodity ordering', () => {
    const first = commodityEventFingerprint({
      title: 'Cobre Panama production halt',
      occurredAt: '2023-11-28T18:00:00Z',
      commodityIds: ['gold', 'copper'],
      entityIds: ['port', 'mine'],
      locationId: 'colon-pa',
    });
    const second = commodityEventFingerprint({
      title: 'Cobre Panama production halt',
      occurredAt: '2023-11-28',
      commodityIds: ['copper', 'gold'],
      entityIds: ['mine', 'port'],
      locationId: 'COLON-PA',
    });
    assert.equal(first, second);
    assert.match(first, /^cne_[a-f0-9]{8}$/);
  });

  it('publishes a material event only after review, date, evidence, claims, and unknowns are recorded', () => {
    const decision = evaluateCommodityEventPublication({
      status: 'published',
      isFixture: false,
      materiality: 'material',
      occurredAt: '2023-11-28',
      publishedAt: '2026-07-28',
      reviewedAt: '2026-07-28',
      reviewedBy: 'CommodityNode Editorial',
      claims: [{ id: 'decision', evidenceIds: ['court'] }],
      evidence: [primaryEvidence],
      unknowns: ['Restart timing is not established by the cited record.'],
    });
    assert.equal(decision.publishable, true);
    assert.equal(decision.hasAuthoritativePrimary, true);
    assert.deepEqual(decision.reasons, []);
  });

  it('fails closed for fixtures and material claims without source diversity or authoritative evidence', () => {
    const decision = evaluateCommodityEventPublication({
      status: 'published',
      isFixture: true,
      materiality: 'material',
      occurredAt: '2026-07-27',
      publishedAt: '2026-07-28',
      reviewedAt: '2026-07-28',
      reviewedBy: 'Reviewer',
      claims: [{ id: 'claim', evidenceIds: ['company'] }],
      evidence: [{
        id: 'company',
        url: 'https://company.example/report',
        publisher: 'Company',
        kind: 'company_primary',
        locator: 'Operating update section.',
        supportsClaims: ['claim'],
      }],
      unknowns: ['This fixture has no real-world status.'],
    });
    assert.equal(decision.publishable, false);
    assert.ok(decision.reasons.includes('fixture_cannot_be_published'));
    assert.ok(decision.reasons.includes('high_materiality_needs_primary_or_source_diversity'));
  });
});
