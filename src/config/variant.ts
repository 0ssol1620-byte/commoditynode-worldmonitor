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

export const SITE_VARIANT: SiteVariant = (() => {
  if (typeof window === 'undefined') return buildVariant;

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (isTauri) {
    const stored = loadStoredVariant();
    if (stored) return stored;
    return buildVariant;
  }

  const hostVariant = resolveSiteVariantFromHostname(location.hostname);
  if (hostVariant) return hostVariant;

  if (isLocalVariantHost(location.hostname)) {
    const stored = loadStoredVariant();
    if (stored) return stored;
    return buildVariant;
  }

  return 'full';
})();
