export const VALID_VARIANTS = [
  'full',
  'tech',
  'finance',
  'commodity',
  'happy',
  'energy',
  'commoditynode',
] as const;

export type SiteVariant = typeof VALID_VARIANTS[number];

const VALID_VARIANT_SET = new Set<string>(VALID_VARIANTS);

export function isSiteVariant(value: unknown): value is SiteVariant {
  return typeof value === 'string' && VALID_VARIANT_SET.has(value);
}

export function normalizeSiteVariant(value: unknown, fallback: SiteVariant = 'full'): SiteVariant {
  return isSiteVariant(value) ? value : fallback;
}

/**
 * Resolve only the public hostnames owned by a variant. Local/self-hosted
 * builds use VITE_VARIANT or an explicit stored preference instead.
 */
export function resolveSiteVariantFromHostname(hostname: string): SiteVariant | null {
  const host = hostname.toLowerCase().split(':', 1)[0] ?? '';

  if (host === 'live.commoditynode.com') return 'commoditynode';
  if (host === 'tech.worldmonitor.app') return 'tech';
  if (host === 'finance.worldmonitor.app') return 'finance';
  if (host === 'commodity.worldmonitor.app') return 'commodity';
  if (host === 'happy.worldmonitor.app') return 'happy';
  if (host === 'energy.worldmonitor.app') return 'energy';
  if (host === 'worldmonitor.app' || host === 'www.worldmonitor.app') return 'full';

  return null;
}

export function isLocalVariantHost(hostname: string): boolean {
  const host = hostname.toLowerCase().split(':', 1)[0] ?? '';
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function isCommoditySiteVariant(variant: SiteVariant): boolean {
  return variant === 'commodity' || variant === 'commoditynode';
}
