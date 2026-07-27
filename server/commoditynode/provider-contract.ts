import {
  createCommodityNodeFreshnessEnvelope,
  type CommodityNodeFreshnessEnvelope,
} from '../../shared/commoditynode-data-contracts';

export interface CommodityNodeNormalizedObservation {
  seriesId: string;
  value: number | string;
  unit: string;
  asOf: string;
  sourcePublishedAt: string | null;
  sourceLabel: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CommodityNodeProviderRequest {
  seriesId: string;
  limit?: number;
}

export interface CommodityNodeProviderContext {
  fetch: typeof globalThis.fetch;
  now: string;
  secrets?: Readonly<Record<string, string | undefined>>;
}

export interface CommodityNodeProviderSeries {
  id: string;
  unit: string;
  staleAfterMs: number;
  expiresAfterMs: number;
  publicDisplayApproved: boolean;
  rightsNote: string;
}

export interface CommodityNodeProviderAdapter {
  id: string;
  sourceId: string;
  sourceLabel: string;
  series: readonly CommodityNodeProviderSeries[];
  fetchSeries(
    request: CommodityNodeProviderRequest,
    context: CommodityNodeProviderContext,
  ): Promise<CommodityNodeNormalizedObservation[]>;
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PROVIDER_HOSTS = new Set([
  'api.eia.gov',
  'api.stlouisfed.org',
  'api.worldbank.org',
  'query1.finance.yahoo.com',
  'quickstats.nass.usda.gov',
  'www.sciencebase.gov',
]);
const MAX_PROVIDER_REDIRECTS = 3;
const MAX_PROVIDER_RESPONSE_BYTES = 5 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 15_000;

function addMilliseconds(timestamp: string, milliseconds: number): string {
  return new Date(Date.parse(timestamp) + milliseconds).toISOString();
}

function safeProviderReason(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value
    .replace(/([?&](?:api_key|apikey|key|token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[redacted]')
    .slice(0, 240);
}

export async function runCommodityNodeProviderAdapter(
  adapter: CommodityNodeProviderAdapter,
  request: CommodityNodeProviderRequest,
  context: CommodityNodeProviderContext,
): Promise<CommodityNodeFreshnessEnvelope<readonly CommodityNodeNormalizedObservation[]>> {
  if (!ISO_UTC.test(context.now) || !Number.isFinite(Date.parse(context.now))) {
    throw new Error('[commoditynode-provider] context.now must be an ISO UTC timestamp');
  }
  const series = adapter.series.find((item) => item.id === request.seriesId);
  if (!series) {
    throw new Error(`[commoditynode-provider] ${adapter.id} does not allow ${request.seriesId}`);
  }
  const staleAt = addMilliseconds(context.now, series.staleAfterMs);
  const expiresAt = addMilliseconds(context.now, series.expiresAfterMs);

  try {
    const observations = await adapter.fetchSeries(request, context);
    if (observations.length === 0) {
      throw new Error('provider returned no usable observations');
    }
    for (const observation of observations) {
      if (observation.seriesId !== series.id) {
        throw new Error(`provider returned unexpected series ${observation.seriesId}`);
      }
      if (observation.unit !== series.unit) {
        throw new Error(`provider returned unexpected unit ${observation.unit}`);
      }
      if (!ISO_UTC.test(observation.asOf) || !Number.isFinite(Date.parse(observation.asOf))) {
        throw new Error(`provider returned invalid as-of time for ${series.id}`);
      }
    }
    return createCommodityNodeFreshnessEnvelope<
      readonly CommodityNodeNormalizedObservation[]
    >({
      data: observations,
      sourceId: adapter.sourceId,
      asOf: observations[0]!.asOf,
      fetchedAt: context.now,
      staleAt,
      expiresAt,
      now: context.now,
      reason: series.publicDisplayApproved ? null : series.rightsNote,
    });
  } catch (error) {
    return createCommodityNodeFreshnessEnvelope<
      readonly CommodityNodeNormalizedObservation[]
    >({
      data: null,
      sourceId: adapter.sourceId,
      asOf: null,
      fetchedAt: context.now,
      staleAt,
      expiresAt,
      now: context.now,
      reason: safeProviderReason(error),
    });
  }
}

export function toProviderTimestamp(value: string): string {
  if (/^\d{4}$/.test(value)) return `${value}-01-01T00:00:00.000Z`;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01T00:00:00.000Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00.000Z`;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) {
    throw new Error(`invalid provider timestamp: ${value}`);
  }
  return parsed.toISOString();
}

export function toProviderNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === '.') return null;
  const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export async function fetchProviderJson(
  fetcher: typeof globalThis.fetch,
  url: URL,
  init: RequestInit = {},
): Promise<unknown> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    throw new Error(`provider method ${method} is not allowed`);
  }

  let currentUrl = new URL(url);
  for (let redirectCount = 0; redirectCount <= MAX_PROVIDER_REDIRECTS; redirectCount += 1) {
    assertCommodityNodeProviderUrl(currentUrl);
    const response = await fetcher(currentUrl, {
      ...init,
      method,
      redirect: 'manual',
      signal: init.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        'user-agent': 'CommodityNode/1.0 data-operations@commoditynode.com',
        ...init.headers,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('provider redirect omitted location');
      if (redirectCount === MAX_PROVIDER_REDIRECTS) {
        throw new Error('provider redirect limit exceeded');
      }
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    if (!response.ok) {
      throw new Error(
        `${currentUrl.origin}${currentUrl.pathname} returned HTTP ${response.status}`,
      );
    }

    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new Error('provider response exceeds byte limit');
    }
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
      throw new Error('provider response exceeds byte limit');
    }
    return JSON.parse(body) as unknown;
  }
  throw new Error('provider redirect limit exceeded');
}

export function assertCommodityNodeProviderUrl(url: URL): void {
  if (
    url.protocol !== 'https:'
    || (url.port !== '' && url.port !== '443')
    || url.username !== ''
    || url.password !== ''
    || !PROVIDER_HOSTS.has(url.hostname.toLowerCase())
  ) {
    throw new Error(`provider origin ${url.origin} is not allowed`);
  }
}
