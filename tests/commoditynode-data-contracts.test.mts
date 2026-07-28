import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
  createCommodityNodeFreshnessEnvelope,
  evaluateCommodityNodePublication,
  validateCommodityNodeBenchmarkContract,
  validateCommodityNodeClaim,
  validateCommodityNodeDataSourceRegistry,
  validateCommodityNodeSourceRecord,
  type CommodityNodeClaim,
  type CommodityNodePublicationContract,
  type CommodityNodeSourceRecord,
} from '../shared/commoditynode-data-contracts';
import {
  COMMODITYNODE_BENCHMARKS,
  COMMODITYNODE_DATA_SOURCES,
} from '../shared/commoditynode-data-source-registry';

const root = resolve(import.meta.dirname, '..');
const sourceIds = new Set(COMMODITYNODE_DATA_SOURCES.map((source) => source.id));

describe('CommodityNode data governance contracts', () => {
  it('validates the source registry and all benchmark contracts', () => {
    validateCommodityNodeDataSourceRegistry(COMMODITYNODE_DATA_SOURCES);
    for (const benchmark of COMMODITYNODE_BENCHMARKS) {
      validateCommodityNodeBenchmarkContract(benchmark, sourceIds);
    }
    assert.equal(sourceIds.size, COMMODITYNODE_DATA_SOURCES.length);
  });

  it('keeps the four public hub benchmark semantics aligned with the registry', () => {
    for (const benchmark of COMMODITYNODE_BENCHMARKS) {
      const commodity = JSON.parse(
        readFileSync(
          resolve(root, 'blog-site', 'src', 'content', 'commodities', `${benchmark.commodityId}.json`),
          'utf8',
        ),
      ) as {
        benchmark: {
          name: string;
          symbol: string;
          instrumentType: string;
          exchange: string;
          unit: string;
          currency: string;
          caveat: string;
        };
      };
      assert.equal(commodity.benchmark.name, benchmark.name);
      assert.equal(commodity.benchmark.symbol, benchmark.providerSymbol);
      assert.equal(commodity.benchmark.instrumentType, benchmark.instrumentType);
      assert.equal(commodity.benchmark.exchange, benchmark.exchange);
      assert.equal(commodity.benchmark.unit, benchmark.unit);
      assert.equal(commodity.benchmark.currency, benchmark.currency);
      assert.ok(commodity.benchmark.caveat.length >= 40);
    }
  });

  it('requires exact locators and evidence-linked reviewed claims', () => {
    const sourceRecord: CommodityNodeSourceRecord = {
      id: 'eia-hormuz-2026-07-28',
      sourceId: 'eia',
      title: 'World Oil Transit Chokepoints',
      publisher: 'U.S. Energy Information Administration',
      locator: {
        url: 'https://www.eia.gov/international/content/analysis/special_topics/World_Oil_Transit_Chokepoints/',
        retrievedAt: '2026-07-28T00:00:00Z',
        locatorType: 'section',
        exactLocator: 'Strait of Hormuz section',
      },
      contentHash: null,
      archivedUrl: null,
      reviewedAt: '2026-07-28T00:00:00Z',
      reviewedBy: 'CommodityNode Editorial',
    };
    validateCommodityNodeSourceRecord(sourceRecord, sourceIds);

    const claim: CommodityNodeClaim = {
      id: 'claim-hormuz-crude-route',
      subjectId: 'route-strait-of-hormuz',
      statement: 'The Strait of Hormuz is a material transit route in the global crude-oil supply chain.',
      status: 'reviewed',
      sourceRecordIds: [sourceRecord.id],
      validFrom: '2026-07-28T00:00:00Z',
      validTo: null,
      reviewedAt: '2026-07-28T00:00:00Z',
      reviewedBy: 'CommodityNode Editorial',
      supersedesClaimId: null,
    };
    validateCommodityNodeClaim(claim, new Set([sourceRecord.id]));

    assert.throws(
      () => validateCommodityNodeSourceRecord(
        { ...sourceRecord, locator: { ...sourceRecord.locator, exactLocator: '' } },
        sourceIds,
      ),
      /exact locator is required/,
    );
  });

  it('computes fresh, stale, expired and unavailable states at deterministic boundaries', () => {
    const base = {
      sourceId: 'eia',
      asOf: '2026-07-28T00:00:00Z',
      fetchedAt: '2026-07-28T01:00:00Z',
      staleAt: '2026-07-28T02:00:00Z',
      expiresAt: '2026-07-28T04:00:00Z',
    };
    assert.equal(
      createCommodityNodeFreshnessEnvelope({ ...base, data: { value: 1 }, now: '2026-07-28T01:59:59Z' }).status,
      'fresh',
    );
    assert.equal(
      createCommodityNodeFreshnessEnvelope({ ...base, data: { value: 1 }, now: '2026-07-28T02:00:00Z' }).status,
      'stale',
    );
    assert.equal(
      createCommodityNodeFreshnessEnvelope({ ...base, data: { value: 1 }, now: '2026-07-28T04:00:00Z' }).status,
      'expired',
    );
    assert.equal(
      createCommodityNodeFreshnessEnvelope({ ...base, data: null, now: '2026-07-28T01:30:00Z' }).status,
      'unavailable',
    );
  });

  it('fails closed for unlicensed quote data without taking unrelated modules offline', () => {
    const reviewedContract: CommodityNodePublicationContract = {
      id: 'commodity-copper-page',
      scope: 'page',
      state: 'reviewed',
      sourceIds: ['yahoo-finance'],
      evidenceRecordIds: ['source-record-1'],
      reviewedAt: '2026-07-28T00:00:00Z',
      reviewedBy: 'CommodityNode Editorial',
      visibility: 'public',
      allowStaleWithDisclosure: true,
    };
    const quote = createCommodityNodeFreshnessEnvelope({
      data: { value: 5.67 },
      sourceId: 'yahoo-finance',
      asOf: '2026-07-28T00:00:00Z',
      fetchedAt: '2026-07-28T00:01:00Z',
      staleAt: '2026-07-28T00:16:00Z',
      expiresAt: '2026-07-28T01:01:00Z',
      now: '2026-07-28T00:05:00Z',
    });
    const quoteDecision = evaluateCommodityNodePublication({
      contract: reviewedContract,
      sources: COMMODITYNODE_DATA_SOURCES,
      freshness: [quote],
      now: '2026-07-28T00:05:00Z',
    });
    assert.equal(quoteDecision.publishable, false);
    assert.deepEqual(quoteDecision.blockers, ['rights_not_approved']);

    const officialDecision = evaluateCommodityNodePublication({
      contract: { ...reviewedContract, id: 'eia-route-module', scope: 'module', sourceIds: ['eia'] },
      sources: COMMODITYNODE_DATA_SOURCES,
      freshness: [{ ...quote, sourceId: 'eia' }],
      now: '2026-07-28T00:05:00Z',
    });
    assert.equal(officialDecision.publishable, true);
    assert.deepEqual(officialDecision.blockers, []);
  });

  it('allows disclosed stale official data but blocks expired or unavailable data', () => {
    const contract: CommodityNodePublicationContract = {
      id: 'official-series-module',
      scope: 'module',
      state: 'published',
      sourceIds: ['eia'],
      evidenceRecordIds: ['source-record-1'],
      reviewedAt: '2026-07-28T00:00:00Z',
      reviewedBy: 'CommodityNode Editorial',
      visibility: 'public',
      allowStaleWithDisclosure: true,
    };
    const stale = createCommodityNodeFreshnessEnvelope({
      data: { value: 1 },
      sourceId: 'eia',
      asOf: '2026-07-27T00:00:00Z',
      fetchedAt: '2026-07-28T00:00:00Z',
      staleAt: '2026-07-28T01:00:00Z',
      expiresAt: '2026-07-29T00:00:00Z',
      now: '2026-07-28T02:00:00Z',
    });
    const staleDecision = evaluateCommodityNodePublication({
      contract,
      sources: COMMODITYNODE_DATA_SOURCES,
      freshness: [stale],
      now: '2026-07-28T02:00:00Z',
    });
    assert.equal(staleDecision.publishable, true);
    assert.equal(staleDecision.disclosureRequired, true);

    const unavailableDecision = evaluateCommodityNodePublication({
      contract,
      sources: COMMODITYNODE_DATA_SOURCES,
      freshness: [{ ...stale, data: null, status: 'unavailable' }],
      now: '2026-07-28T02:00:00Z',
    });
    assert.equal(unavailableDecision.publishable, false);
    assert.deepEqual(unavailableDecision.blockers, ['unavailable_data']);
  });
});
