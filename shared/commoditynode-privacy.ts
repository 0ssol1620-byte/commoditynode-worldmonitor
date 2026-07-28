export const COMMODITYNODE_CONSENT_VERSION = 1;
export const COMMODITYNODE_CONSENT_STORAGE_KEY = 'commoditynode:consent:v1';
export const COMMODITYNODE_CONSENT_EVENT = 'commoditynode:consent-changed';

export interface CommodityNodeConsent {
  version: typeof COMMODITYNODE_CONSENT_VERSION;
  necessary: true;
  analytics: boolean;
  advertising: boolean;
  decidedAt: string;
  source: 'banner' | 'settings';
}

export function isCommodityNodeConsent(value: unknown): value is CommodityNodeConsent {
  if (!value || typeof value !== 'object') return false;
  const consent = value as Record<string, unknown>;
  return consent.version === COMMODITYNODE_CONSENT_VERSION
    && consent.necessary === true
    && typeof consent.analytics === 'boolean'
    && typeof consent.advertising === 'boolean'
    && typeof consent.decidedAt === 'string'
    && Number.isFinite(Date.parse(consent.decidedAt))
    && (consent.source === 'banner' || consent.source === 'settings');
}

export function parseCommodityNodeConsent(serialized: string | null): CommodityNodeConsent | null {
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isCommodityNodeConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createCommodityNodeConsent(
  choices: Pick<CommodityNodeConsent, 'analytics' | 'advertising' | 'source'>,
  decidedAt = new Date().toISOString(),
): CommodityNodeConsent {
  if (!Number.isFinite(Date.parse(decidedAt))) {
    throw new Error('CommodityNode consent requires a valid ISO timestamp');
  }
  return {
    version: COMMODITYNODE_CONSENT_VERSION,
    necessary: true,
    analytics: choices.analytics,
    advertising: choices.advertising,
    decidedAt,
    source: choices.source,
  };
}

