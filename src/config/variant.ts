import {
  isLocalVariantHost,
  isSiteVariant,
  normalizeSiteVariant,
  resolveSiteVariantFromHostname,
  type SiteVariant,
} from './variant-registry';

const buildVariant: SiteVariant = (() => {
  try {
    return normalizeSiteVariant(import.meta.env.VITE_VARIANT);
  } catch {
    return 'full';
  }
})();

function loadStoredVariant(): SiteVariant | null {
  try {
    const stored = localStorage.getItem('worldmonitor-variant');
    return isSiteVariant(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function resolveRuntimeSiteVariant(
  hostname: string,
  compiledVariant: SiteVariant,
  storedVariant: SiteVariant | null,
  isDesktopRuntime: boolean,
): SiteVariant {
  if (isDesktopRuntime) {
    return storedVariant ?? compiledVariant;
  }

  const hostVariant = resolveSiteVariantFromHostname(hostname);
  if (hostVariant) return hostVariant;

  if (isLocalVariantHost(hostname)) {
    return storedVariant ?? compiledVariant;
  }

  // Most public World Monitor deployments are one `full` build whose hostname
  // selects the product at runtime. CommodityNode Live is intentionally a
  // dedicated build, so its verified compile-time variant must also survive
  // Vercel's fallback and preview hostnames before custom DNS is available.
  if (compiledVariant !== 'full') return compiledVariant;

  return 'full';
}

export const SITE_VARIANT: SiteVariant = (() => {
  if (typeof window === 'undefined') return buildVariant;

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  return resolveRuntimeSiteVariant(
    location.hostname,
    buildVariant,
    loadStoredVariant(),
    isTauri,
  );
})();
