import type { CommodityNodeDataSource } from '../../shared/commoditynode-data-contracts';
import {
  fetchProviderJson,
  toProviderNumber,
  type CommodityNodeNormalizedObservation,
  type CommodityNodeProviderAdapter,
  type CommodityNodeProviderContext,
  type CommodityNodeProviderRequest,
} from './provider-contract';

const SYMBOL_BY_SERIES = {
  'yahoo.copper-comex-hg': 'HG=F',
  'yahoo.crude-oil-nymex-wti': 'CL=F',
  'yahoo.gold-comex-gc': 'GC=F',
  'yahoo.cocoa-ice-us-cc': 'CC=F',
} as const;

const UNIT_BY_SERIES: Record<keyof typeof SYMBOL_BY_SERIES, string> = {
  'yahoo.copper-comex-hg': 'USD/lb',
  'yahoo.crude-oil-nymex-wti': 'USD/barrel',
  'yahoo.gold-comex-gc': 'USD/troy ounce',
  'yahoo.cocoa-ice-us-cc': 'USD/metric ton',
};

type YahooSeriesId = keyof typeof SYMBOL_BY_SERIES;

export function createYahooFinanceProviderAdapter(input: {
  source: CommodityNodeDataSource;
  minimumIntervalMs?: number;
  cacheTtlMs?: number;
}): CommodityNodeProviderAdapter {
  const minimumIntervalMs = input.minimumIntervalMs ?? 1_200;
  const cacheTtlMs = input.cacheTtlMs ?? 60_000;
  const cache = new Map<string, {
    expiresAt: number;
    rows: CommodityNodeNormalizedObservation[];
  }>();
  let nextRequestAt = 0;

  return {
    id: 'yahoo-finance-chart-v1',
    sourceId: input.source.id,
    sourceLabel: 'Yahoo Finance · financial-market proxy · provider-defined delay',
    series: Object.keys(SYMBOL_BY_SERIES).map((id) => ({
      id,
      unit: UNIT_BY_SERIES[id as YahooSeriesId],
      staleAfterMs: 15 * 60_000,
      expiresAfterMs: 60 * 60_000,
      publicDisplayApproved:
        input.source.rights.status === 'approved' && input.source.rights.publicDisplay,
      rightsNote:
        'Yahoo quote display is blocked until a reviewed license permits public use.',
    })),
    async fetchSeries(request: CommodityNodeProviderRequest, context: CommodityNodeProviderContext) {
      if (input.source.rights.status !== 'approved' || !input.source.rights.publicDisplay) {
        throw new Error('rights_not_approved: Yahoo quote collection and display are disabled');
      }
      const now = Date.parse(context.now);
      const cached = cache.get(request.seriesId);
      if (cached && cached.expiresAt > now) {
        return cached.rows.map((row) => ({
          ...row,
          metadata: { ...row.metadata, cacheHit: true },
        }));
      }
      if (now < nextRequestAt) {
        throw new Error('provider_backoff: stagger interval has not elapsed');
      }
      nextRequestAt = now + minimumIntervalMs;

      const seriesId = request.seriesId as YahooSeriesId;
      const symbol = SYMBOL_BY_SERIES[seriesId];
      if (!symbol) return [];
      const url = new URL(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
      );
      url.searchParams.set('interval', '1m');
      url.searchParams.set('range', '1d');
      const payload = await fetchProviderJson(context.fetch, url) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: unknown[] }> };
          }>;
          error?: unknown;
        };
      };
      const result = payload.chart?.result?.[0];
      const timestamps = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const rows = timestamps
        .map((timestamp, index): CommodityNodeNormalizedObservation | null => {
          const value = toProviderNumber(closes[index]);
          if (value === null) return null;
          return {
            seriesId,
            value,
            unit: UNIT_BY_SERIES[seriesId],
            asOf: new Date(timestamp * 1_000).toISOString(),
            sourcePublishedAt: null,
            sourceLabel: `Yahoo Finance · ${symbol} · financial-market proxy`,
            metadata: {
              symbol,
              delay: 'provider-defined',
              physicalSpotPrice: false,
              cacheHit: false,
            },
          };
        })
        .filter((row): row is CommodityNodeNormalizedObservation => row !== null)
        .reverse()
        .slice(0, Math.min(Math.max(request.limit ?? 60, 1), 120));
      cache.set(request.seriesId, { expiresAt: now + cacheTtlMs, rows });
      return rows;
    },
  };
}
