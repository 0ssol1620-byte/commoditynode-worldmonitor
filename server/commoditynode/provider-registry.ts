import { COMMODITYNODE_DATA_SOURCES } from '../../shared/commoditynode-data-source-registry';
import type { CommodityNodeProviderAdapter } from './provider-contract';
import { COMMODITYNODE_OFFICIAL_PROVIDER_ADAPTERS } from './official-provider-adapters';
import { createYahooFinanceProviderAdapter } from './yahoo-provider-adapter';

const yahooSource = COMMODITYNODE_DATA_SOURCES.find((source) => source.id === 'yahoo-finance');
if (!yahooSource) throw new Error('[commoditynode-provider] Yahoo source contract is missing');

export const COMMODITYNODE_PROVIDER_ADAPTERS = [
  ...COMMODITYNODE_OFFICIAL_PROVIDER_ADAPTERS,
  createYahooFinanceProviderAdapter({ source: yahooSource }),
] as const satisfies readonly CommodityNodeProviderAdapter[];

export function validateCommodityNodeProviderRegistry(
  adapters: readonly CommodityNodeProviderAdapter[],
): void {
  const adapterIds = new Set<string>();
  const seriesIds = new Set<string>();
  const sourceIds = new Set<string>(COMMODITYNODE_DATA_SOURCES.map((source) => source.id));
  for (const adapter of adapters) {
    if (adapterIds.has(adapter.id)) {
      throw new Error(`[commoditynode-provider] duplicate adapter ${adapter.id}`);
    }
    if (!sourceIds.has(adapter.sourceId)) {
      throw new Error(`[commoditynode-provider] unknown source ${adapter.sourceId}`);
    }
    adapterIds.add(adapter.id);
    for (const series of adapter.series) {
      if (seriesIds.has(series.id)) {
        throw new Error(`[commoditynode-provider] duplicate series ${series.id}`);
      }
      if (series.staleAfterMs <= 0 || series.expiresAfterMs < series.staleAfterMs) {
        throw new Error(`[commoditynode-provider] invalid freshness window ${series.id}`);
      }
      seriesIds.add(series.id);
    }
  }
}
