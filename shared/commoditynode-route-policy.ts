export type CommodityNodeRouteType =
  | 'home'
  | 'commodity_directory'
  | 'commodity_hub'
  | 'research_article'
  | 'event_index'
  | 'event_detail'
  | 'company_detail'
  | 'author'
  | 'trust'
  | 'search'
  | 'source_offer'
  | 'live_application'
  | 'api'
  | 'unknown';

export interface CommodityNodeRoutePolicy {
  routeType: CommodityNodeRouteType;
  indexable: boolean;
  follow: boolean;
  adEligible: boolean;
  reason: string;
}

export interface CommodityNodeRouteContext {
  publicationState?: 'candidate' | 'reviewed' | 'published' | 'expired' | 'rejected';
  evidenceCount?: number;
  isFixture?: boolean;
}

/**
 * Empty by design until AdSense approval and a page-level editorial review.
 * Adding a slug here is necessary but not sufficient: the content record must
 * also declare `adEligible: true` and pass the editorial publication gate.
 */
export const COMMODITYNODE_AD_ELIGIBLE_POSTS = new Set<string>();

function normalizePathname(pathname: string): string {
  const clean = pathname.split(/[?#]/, 1)[0] || '/';
  if (clean === '/') return clean;
  return `/${clean.replace(/^\/+|\/+$/g, '')}/`;
}

function publishedEvidencePage(context: CommodityNodeRouteContext): boolean {
  return context.publicationState === 'published'
    && (context.evidenceCount ?? 0) > 0
    && context.isFixture !== true;
}

export function resolveCommodityNodeRoutePolicy(
  pathname: string,
  context: CommodityNodeRouteContext = {},
): CommodityNodeRoutePolicy {
  const path = normalizePathname(pathname);

  if (path === '/') {
    return {
      routeType: 'home',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Editorial product home; advertising is intentionally disabled.',
    };
  }
  if (path === '/commodities/') {
    return {
      routeType: 'commodity_directory',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Evidence-backed directory with distinct benchmark and coverage semantics.',
    };
  }
  if (/^\/commodities\/[^/]+\/$/.test(path)) {
    return {
      routeType: 'commodity_hub',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Reviewed commodity reference page; no ads on decision-support hubs.',
    };
  }
  const post = path.match(/^\/posts\/([^/]+)\/$/);
  if (post) {
    return {
      routeType: 'research_article',
      indexable: true,
      follow: true,
      adEligible: COMMODITYNODE_AD_ELIGIBLE_POSTS.has(post[1]),
      reason: COMMODITYNODE_AD_ELIGIBLE_POSTS.has(post[1])
        ? 'Manually approved long-form research article.'
        : 'Research article not present in the manual advertising allowlist.',
    };
  }
  if (path === '/events/') {
    return {
      routeType: 'event_index',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Published Event Pulse directory; no advertising.',
    };
  }
  if (/^\/events\/[^/]+\/$/.test(path)) {
    const indexable = publishedEvidencePage(context);
    return {
      routeType: 'event_detail',
      indexable,
      follow: indexable,
      adEligible: false,
      reason: indexable
        ? 'Published, evidence-backed, non-fixture Event Pulse.'
        : 'Draft, expired, rejected, unevidenced, or fixture events are noindex.',
    };
  }
  if (/^\/companies\/[^/]+\/$/.test(path)) {
    const indexable = publishedEvidencePage(context);
    return {
      routeType: 'company_detail',
      indexable,
      follow: indexable,
      adEligible: false,
      reason: indexable
        ? 'Published company exposure record with evidence.'
        : 'Company shells and unevidenced records are noindex.',
    };
  }
  if (/^\/authors\/[^/]+\/$/.test(path)) {
    return {
      routeType: 'author',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Accountability and editorial-process profile.',
    };
  }
  if ([
    '/about/',
    '/methodology/',
    '/sources/',
    '/editorial-policy/',
    '/corrections/',
    '/contact/',
    '/privacy/',
  ].includes(path)) {
    return {
      routeType: 'trust',
      indexable: true,
      follow: true,
      adEligible: false,
      reason: 'Substantive trust, governance, or legal page.',
    };
  }
  if (path === '/search/') {
    return {
      routeType: 'search',
      indexable: false,
      follow: true,
      adEligible: false,
      reason: 'Internal search-result combinations are not canonical landing pages.',
    };
  }
  if (path === '/source/') {
    return {
      routeType: 'source_offer',
      indexable: false,
      follow: true,
      adEligible: false,
      reason: 'Operational AGPL source-offer page; discoverable by links but not indexed.',
    };
  }
  if (path.startsWith('/api/')) {
    return {
      routeType: 'api',
      indexable: false,
      follow: false,
      adEligible: false,
      reason: 'Machine endpoint.',
    };
  }
  if (path === '/live/' || path === '/dashboard/') {
    return {
      routeType: 'live_application',
      indexable: false,
      follow: false,
      adEligible: false,
      reason: 'Interactive application shell; research pages carry the crawlable explanation.',
    };
  }
  return {
    routeType: 'unknown',
    indexable: false,
    follow: false,
    adEligible: false,
    reason: 'Unknown routes fail closed until they receive an explicit policy.',
  };
}

export function commodityNodeRobotsContent(policy: CommodityNodeRoutePolicy): string {
  if (!policy.indexable) {
    return policy.follow ? 'noindex, follow' : 'noindex, nofollow';
  }
  return 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
}
