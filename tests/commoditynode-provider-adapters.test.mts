import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CommodityNodeDataSource } from '../shared/commoditynode-data-contracts';
import { COMMODITYNODE_DATA_SOURCES } from '../shared/commoditynode-data-source-registry';
import {
  EIA_PROVIDER_ADAPTER,
  FRED_PROVIDER_ADAPTER,
  USDA_NASS_PROVIDER_ADAPTER,
  USGS_PROVIDER_ADAPTER,
  WORLD_BANK_PROVIDER_ADAPTER,
} from '../server/commoditynode/official-provider-adapters';
import {
  assertCommodityNodeProviderUrl,
  fetchProviderJson,
  runCommodityNodeProviderAdapter,
  type CommodityNodeProviderContext,
} from '../server/commoditynode/provider-contract';
import {
  COMMODITYNODE_PROVIDER_ADAPTERS,
  validateCommodityNodeProviderRegistry,
} from '../server/commoditynode/provider-registry';
import { createYahooFinanceProviderAdapter } from '../server/commoditynode/yahoo-provider-adapter';

const NOW = '2026-07-28T00:00:00.000Z';

function jsonFetch(payload: unknown, onUrl?: (url: URL) => void): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    onUrl?.(url);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('CommodityNode provider adapters', () => {
  it('enforces HTTPS, exact provider origins, bounded redirects, and GET-only fetches', async () => {
    for (const value of [
      'http://api.eia.gov/v2/seriesid/PET.RWTC.D',
      'https://api.eia.gov.evil.example/v2',
      'https://127.0.0.1/internal',
      'https://user:password@api.eia.gov/v2',
      'https://api.eia.gov:444/v2',
    ]) {
      assert.throws(() => assertCommodityNodeProviderUrl(new URL(value)), /not allowed/);
    }
    assert.doesNotThrow(() =>
      assertCommodityNodeProviderUrl(new URL('https://api.eia.gov/v2/seriesid/PET.RWTC.D')),
    );

    const redirectFetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/internal' },
      })) as typeof fetch;
    await assert.rejects(
      () => fetchProviderJson(
        redirectFetch,
        new URL('https://api.eia.gov/v2/seriesid/PET.RWTC.D'),
      ),
      /not allowed/,
    );
    await assert.rejects(
      () => fetchProviderJson(
        jsonFetch({ ok: true }),
        new URL('https://api.eia.gov/v2/seriesid/PET.RWTC.D'),
        { method: 'POST' },
      ),
      /method POST is not allowed/,
    );
  });

  it('registers unique adapters and approved freshness windows', () => {
    assert.doesNotThrow(() => validateCommodityNodeProviderRegistry(
      COMMODITYNODE_PROVIDER_ADAPTERS,
    ));
    assert.equal(COMMODITYNODE_PROVIDER_ADAPTERS.length, 6);
  });

  it('normalizes EIA observations without exposing the API key', async () => {
    let requestedUrl: URL | undefined;
    const result = await runCommodityNodeProviderAdapter(
      EIA_PROVIDER_ADAPTER,
      { seriesId: 'eia.wti-spot-daily', limit: 2 },
      {
        now: NOW,
        secrets: { EIA_API_KEY: 'secret-eia-key-value-123456789' },
        fetch: jsonFetch({
          response: {
            data: [
              { period: '2026-07-25', value: '78.52' },
              { period: '2026-07-24', value: '77.90' },
            ],
          },
        }, (url) => { requestedUrl = url; }),
      },
    );
    assert.equal(result.status, 'fresh');
    assert.equal(result.data?.[0]?.value, 78.52);
    assert.equal(result.data?.[0]?.unit, 'USD/barrel');
    assert.equal(requestedUrl?.searchParams.get('api_key'), 'secret-eia-key-value-123456789');
    assert.doesNotMatch(JSON.stringify(result), /secret-eia-key/);
  });

  it('keeps FRED results rights-blocked and skips missing sentinels', async () => {
    const result = await runCommodityNodeProviderAdapter(
      FRED_PROVIDER_ADAPTER,
      { seriesId: 'fred.dcoilwtico' },
      {
        now: NOW,
        secrets: { FRED_API_KEY: 'secret-fred-key-value-123456789' },
        fetch: jsonFetch({
          observations: [
            { date: '2026-07-25', value: '.' },
            { date: '2026-07-24', value: '77.12' },
          ],
        }),
      },
    );
    assert.equal(result.data?.length, 1);
    assert.equal(result.reason, 'Public display is blocked until the underlying FRED series rights are approved.');
    assert.equal(result.data?.[0]?.metadata.publicDisplayApproved, false);
  });

  it('normalizes World Bank, USDA, and USGS official records', async () => {
    const contexts: Array<[typeof WORLD_BANK_PROVIDER_ADAPTER, string, CommodityNodeProviderContext]> = [
      [
        WORLD_BANK_PROVIDER_ADAPTER,
        'world-bank.world-gdp-current-usd',
        {
          now: NOW,
          fetch: jsonFetch([
            { page: 1 },
            [{ date: '2025', value: 110_000, indicator: { id: 'NY.GDP.MKTP.CD' } }],
          ]),
        },
      ],
      [
        USDA_NASS_PROVIDER_ADAPTER,
        'usda.corn-production-us',
        {
          now: NOW,
          secrets: { USDA_NASS_API_KEY: 'secret-usda-key-value-123456789' },
          fetch: jsonFetch({
            data: [{
              year: '2025',
              Value: '15,100',
              unit_desc: 'BU',
              short_desc: 'CORN, GRAIN - PRODUCTION',
            }],
          }),
        },
      ],
      [
        USGS_PROVIDER_ADAPTER,
        'usgs.mcs-copper-2025-release',
        {
          now: NOW,
          fetch: jsonFetch({
            title: 'Mineral Commodity Summaries 2025 - COPPER Data Release',
            dates: [{ type: 'Publication', dateString: '2025-04-08' }],
          }),
        },
      ],
    ];

    for (const [adapter, seriesId, context] of contexts) {
      const result = await runCommodityNodeProviderAdapter(adapter, { seriesId }, context);
      assert.equal(result.status, 'fresh');
      assert.equal(result.data?.length, 1);
      assert.ok(result.data?.[0]?.sourceLabel);
    }
  });

  it('fails soft and redacts secrets from provider errors', async () => {
    const result = await runCommodityNodeProviderAdapter(
      EIA_PROVIDER_ADAPTER,
      { seriesId: 'eia.wti-spot-daily' },
      {
        now: NOW,
        secrets: { EIA_API_KEY: 'secret-eia-key-value-123456789' },
        fetch: (async () => {
          throw new Error(
            'https://api.eia.gov/v2?api_key=secret-eia-key-value-123456789 failed',
          );
        }) as typeof fetch,
      },
    );
    assert.equal(result.status, 'unavailable');
    assert.equal(result.data, null);
    assert.doesNotMatch(result.reason ?? '', /secret-eia-key/);
    assert.match(result.reason ?? '', /\[redacted\]/);
  });

  it('blocks Yahoo collection without approved rights', async () => {
    const source = COMMODITYNODE_DATA_SOURCES.find((item) => item.id === 'yahoo-finance')!;
    let called = false;
    const adapter = createYahooFinanceProviderAdapter({ source });
    const result = await runCommodityNodeProviderAdapter(
      adapter,
      { seriesId: 'yahoo.copper-comex-hg' },
      {
        now: NOW,
        fetch: (async () => {
          called = true;
          return new Response('{}');
        }) as typeof fetch,
      },
    );
    assert.equal(called, false);
    assert.equal(result.status, 'unavailable');
    assert.match(result.reason ?? '', /rights_not_approved/);
  });

  it('stagger-fetches and caches a licensed Yahoo proxy with explicit labels', async () => {
    const source = COMMODITYNODE_DATA_SOURCES.find((item) => item.id === 'yahoo-finance')!;
    const licensedSource: CommodityNodeDataSource = {
      ...source,
      rights: {
        ...source.rights,
        status: 'approved',
        publicDisplay: true,
        commercialUse: true,
      },
    };
    let calls = 0;
    const adapter = createYahooFinanceProviderAdapter({
      source: licensedSource,
      minimumIntervalMs: 2_000,
      cacheTtlMs: 60_000,
    });
    const context: CommodityNodeProviderContext = {
      now: NOW,
      fetch: jsonFetch({
        chart: {
          result: [{
            timestamp: [1785196800, 1785196860],
            indicators: { quote: [{ close: [5.60, 5.62] }] },
          }],
        },
      }, () => { calls += 1; }),
    };

    const first = await runCommodityNodeProviderAdapter(
      adapter,
      { seriesId: 'yahoo.copper-comex-hg' },
      context,
    );
    const cached = await runCommodityNodeProviderAdapter(
      adapter,
      { seriesId: 'yahoo.copper-comex-hg' },
      context,
    );
    const staggered = await runCommodityNodeProviderAdapter(
      adapter,
      { seriesId: 'yahoo.gold-comex-gc' },
      context,
    );

    assert.equal(first.status, 'fresh');
    assert.equal(first.data?.[0]?.metadata.physicalSpotPrice, false);
    assert.match(first.data?.[0]?.sourceLabel ?? '', /financial-market proxy/);
    assert.equal(cached.data?.[0]?.metadata.cacheHit, true);
    assert.equal(staggered.status, 'unavailable');
    assert.match(staggered.reason ?? '', /stagger interval/);
    assert.equal(calls, 1);
  });
});
