export type CommodityNodeLegacyDisposition =
  | {
    state: 'redirect';
    destination: string;
    reason: string;
  }
  | {
    state: 'gone';
    destination: null;
    reason: string;
  }
  | {
    state: 'not_legacy';
    destination: null;
    reason: string;
  };

export const COMMODITYNODE_LEGACY_REDIRECTS = [
  {
    source: '/reports/from-chokepoint-event-to-market-impact',
    destination: '/posts/from-chokepoint-event-to-market-impact/',
    reason: 'The reviewed research article is a direct substantive successor.',
  },
  {
    source: '/reports/cobre-panama-production-halt',
    destination: '/events/cobre-panama-production-halt/',
    reason: 'The evidence-backed Event Pulse is a direct substantive successor.',
  },
] as const;

export const COMMODITYNODE_GONE_ROUTE_FAMILIES = [
  '/reports',
  '/intelligence-lab',
  '/simulator',
  '/stress-test',
  '/pricing',
  '/enterprise',
  '/pro',
  '/signals',
  '/calendar',
  '/disruptions',
  '/tags',
  '/tools',
] as const;

function normalizedLegacyPath(pathname: string): string {
  const clean = pathname.split(/[?#]/, 1)[0] || '/';
  if (clean === '/') return clean;
  return `/${clean.replace(/^\/+|\/+$/g, '')}`;
}

export function resolveCommodityNodeLegacyDisposition(
  pathname: string,
): CommodityNodeLegacyDisposition {
  const path = normalizedLegacyPath(pathname);
  const redirect = COMMODITYNODE_LEGACY_REDIRECTS.find(
    (entry) => entry.source === path,
  );
  if (redirect) {
    return {
      state: 'redirect',
      destination: redirect.destination,
      reason: redirect.reason,
    };
  }

  if (
    COMMODITYNODE_GONE_ROUTE_FAMILIES.some(
      (family) => path === family || path.startsWith(`${family}/`),
    )
  ) {
    return {
      state: 'gone',
      destination: null,
      reason:
        'No reviewed, substantively equivalent CommodityNode page is available. The route must not be redirected to an unrelated destination.',
    };
  }

  return {
    state: 'not_legacy',
    destination: null,
    reason: 'The path is outside the controlled legacy-route manifest.',
  };
}
