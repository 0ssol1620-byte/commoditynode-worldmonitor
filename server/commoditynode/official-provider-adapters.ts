import {
  fetchProviderJson,
  toProviderNumber,
  toProviderTimestamp,
  type CommodityNodeNormalizedObservation,
  type CommodityNodeProviderAdapter,
  type CommodityNodeProviderContext,
  type CommodityNodeProviderRequest,
} from './provider-contract';

const DAY = 86_400_000;

function requiredSecret(
  context: CommodityNodeProviderContext,
  key: string,
): string {
  const value = context.secrets?.[key]?.trim();
  if (!value) throw new Error(`missing server-side ${key}`);
  return value;
}

function boundedLimit(request: CommodityNodeProviderRequest): number {
  return Math.min(Math.max(request.limit ?? 24, 1), 120);
}

export const EIA_PROVIDER_ADAPTER: CommodityNodeProviderAdapter = {
  id: 'eia-v2',
  sourceId: 'eia',
  sourceLabel: 'U.S. Energy Information Administration',
  series: [{
    id: 'eia.wti-spot-daily',
    unit: 'USD/barrel',
    staleAfterMs: 3 * DAY,
    expiresAfterMs: 14 * DAY,
    publicDisplayApproved: true,
    rightsNote: 'EIA attribution and publication date are required.',
  }],
  async fetchSeries(request, context) {
    const apiKey = requiredSecret(context, 'EIA_API_KEY');
    const url = new URL('https://api.eia.gov/v2/seriesid/PET.RWTC.D');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('length', String(boundedLimit(request)));
    const payload = await fetchProviderJson(context.fetch, url) as {
      response?: { data?: Array<{ period?: string; value?: unknown }> };
    };
    return (payload.response?.data ?? [])
      .map((row): CommodityNodeNormalizedObservation | null => {
        const value = toProviderNumber(row.value);
        if (value === null || !row.period) return null;
        return {
          seriesId: request.seriesId,
          value,
          unit: 'USD/barrel',
          asOf: toProviderTimestamp(row.period),
          sourcePublishedAt: null,
          sourceLabel: 'EIA · WTI spot price · daily',
          metadata: { providerSeries: 'PET.RWTC.D', delay: 'official release cadence' },
        };
      })
      .filter((row): row is CommodityNodeNormalizedObservation => row !== null);
  },
};

export const FRED_PROVIDER_ADAPTER: CommodityNodeProviderAdapter = {
  id: 'fred-v2',
  sourceId: 'fred',
  sourceLabel: 'Federal Reserve Economic Data',
  series: [{
    id: 'fred.dcoilwtico',
    unit: 'USD/barrel',
    staleAfterMs: 3 * DAY,
    expiresAfterMs: 14 * DAY,
    publicDisplayApproved: false,
    rightsNote: 'Public display is blocked until the underlying FRED series rights are approved.',
  }],
  async fetchSeries(request, context) {
    const apiKey = requiredSecret(context, 'FRED_API_KEY');
    const url = new URL('https://api.stlouisfed.org/fred/series/observations');
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('file_type', 'json');
    url.searchParams.set('series_id', 'DCOILWTICO');
    url.searchParams.set('sort_order', 'desc');
    url.searchParams.set('limit', String(boundedLimit(request)));
    const payload = await fetchProviderJson(context.fetch, url) as {
      observations?: Array<{ date?: string; value?: unknown }>;
    };
    return (payload.observations ?? [])
      .map((row): CommodityNodeNormalizedObservation | null => {
        const value = toProviderNumber(row.value);
        if (value === null || !row.date) return null;
        return {
          seriesId: request.seriesId,
          value,
          unit: 'USD/barrel',
          asOf: toProviderTimestamp(row.date),
          sourcePublishedAt: null,
          sourceLabel: 'FRED · DCOILWTICO · underlying publisher rights pending',
          metadata: { providerSeries: 'DCOILWTICO', publicDisplayApproved: false },
        };
      })
      .filter((row): row is CommodityNodeNormalizedObservation => row !== null);
  },
};

export const WORLD_BANK_PROVIDER_ADAPTER: CommodityNodeProviderAdapter = {
  id: 'world-bank-v2',
  sourceId: 'world-bank-open-data',
  sourceLabel: 'World Bank Open Data',
  series: [{
    id: 'world-bank.world-gdp-current-usd',
    unit: 'current USD',
    staleAfterMs: 400 * DAY,
    expiresAfterMs: 800 * DAY,
    publicDisplayApproved: true,
    rightsNote: 'World Bank attribution, indicator, period, and access date are required.',
  }],
  async fetchSeries(request, context) {
    const url = new URL(
      'https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD',
    );
    url.searchParams.set('format', 'json');
    url.searchParams.set('per_page', String(boundedLimit(request)));
    const payload = await fetchProviderJson(context.fetch, url) as [
      unknown,
      Array<{ date?: string; value?: unknown; indicator?: { id?: string } }>?,
    ];
    return (payload[1] ?? [])
      .map((row): CommodityNodeNormalizedObservation | null => {
        const value = toProviderNumber(row.value);
        if (value === null || !row.date) return null;
        return {
          seriesId: request.seriesId,
          value,
          unit: 'current USD',
          asOf: toProviderTimestamp(row.date),
          sourcePublishedAt: null,
          sourceLabel: 'World Bank · NY.GDP.MKTP.CD · World',
          metadata: { indicator: row.indicator?.id ?? 'NY.GDP.MKTP.CD', economy: 'WLD' },
        };
      })
      .filter((row): row is CommodityNodeNormalizedObservation => row !== null);
  },
};

export const USDA_NASS_PROVIDER_ADAPTER: CommodityNodeProviderAdapter = {
  id: 'usda-nass-v1',
  sourceId: 'usda-nass',
  sourceLabel: 'USDA National Agricultural Statistics Service',
  series: [{
    id: 'usda.corn-production-us',
    unit: 'BU',
    staleAfterMs: 45 * DAY,
    expiresAfterMs: 120 * DAY,
    publicDisplayApproved: true,
    rightsNote: 'USDA NASS attribution and query dimensions are required.',
  }],
  async fetchSeries(request, context) {
    const apiKey = requiredSecret(context, 'USDA_NASS_API_KEY');
    const url = new URL('https://quickstats.nass.usda.gov/api/api_GET/');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('commodity_desc', 'CORN');
    url.searchParams.set('statisticcat_desc', 'PRODUCTION');
    url.searchParams.set('agg_level_desc', 'NATIONAL');
    url.searchParams.set('format', 'JSON');
    const payload = await fetchProviderJson(context.fetch, url) as {
      data?: Array<{
        year?: string;
        Value?: unknown;
        unit_desc?: string;
        short_desc?: string;
      }>;
    };
    return (payload.data ?? [])
      .slice(0, boundedLimit(request))
      .map((row): CommodityNodeNormalizedObservation | null => {
        const value = toProviderNumber(row.Value);
        if (value === null || !row.year || row.unit_desc !== 'BU') return null;
        return {
          seriesId: request.seriesId,
          value,
          unit: 'BU',
          asOf: toProviderTimestamp(row.year),
          sourcePublishedAt: null,
          sourceLabel: 'USDA NASS Quick Stats · CORN PRODUCTION · NATIONAL',
          metadata: { query: row.short_desc ?? 'CORN - PRODUCTION', geography: 'US' },
        };
      })
      .filter((row): row is CommodityNodeNormalizedObservation => row !== null);
  },
};

export const USGS_PROVIDER_ADAPTER: CommodityNodeProviderAdapter = {
  id: 'usgs-sciencebase-v1',
  sourceId: 'usgs-nmic',
  sourceLabel: 'USGS National Minerals Information Center',
  series: [{
    id: 'usgs.mcs-copper-2025-release',
    unit: 'dataset release',
    staleAfterMs: 400 * DAY,
    expiresAfterMs: 800 * DAY,
    publicDisplayApproved: true,
    rightsNote: 'USGS citation and record-level third-party review are required.',
  }],
  async fetchSeries(request, context) {
    const url = new URL(
      'https://www.sciencebase.gov/catalog/item/6797fba5d34ea8c18376e15d',
    );
    url.searchParams.set('format', 'json');
    const payload = await fetchProviderJson(context.fetch, url) as {
      title?: string;
      dates?: Array<{ type?: string; dateString?: string }>;
      provenance?: { dateCreated?: string };
    };
    if (!payload.title) return [];
    const published = payload.dates?.find((date) => date.type === 'Publication')?.dateString
      ?? payload.provenance?.dateCreated;
    if (!published) return [];
    return [{
      seriesId: request.seriesId,
      value: payload.title,
      unit: 'dataset release',
      asOf: toProviderTimestamp(published),
      sourcePublishedAt: toProviderTimestamp(published),
      sourceLabel: 'USGS NMIC · Mineral Commodity Summaries 2025 copper data release',
      metadata: {
        scienceBaseItem: '6797fba5d34ea8c18376e15d',
        quantitativeUseRequiresFileLocator: true,
      },
    }];
  },
};

export const COMMODITYNODE_OFFICIAL_PROVIDER_ADAPTERS = [
  EIA_PROVIDER_ADAPTER,
  FRED_PROVIDER_ADAPTER,
  WORLD_BANK_PROVIDER_ADAPTER,
  USDA_NASS_PROVIDER_ADAPTER,
  USGS_PROVIDER_ADAPTER,
] as const;
