export type CommodityNodeCatalogAuthority =
  | 'authoritative_primary'
  | 'company_primary'
  | 'official_analysis';

export type CommodityNodeCatalogTransport = 'rss' | 'api' | 'html' | 'download';

export type CommodityNodeCatalogRightsMode =
  | 'public_domain_with_exceptions'
  | 'public_access_metadata_only'
  | 'link_and_fact_extraction_only';

export interface CommodityNodeSourceCatalogEntry {
  id: string;
  name: string;
  publisher: string;
  authority: CommodityNodeCatalogAuthority;
  transport: CommodityNodeCatalogTransport;
  accessUrl: string;
  documentationUrl: string;
  termsUrl: string;
  targetCommodityIds: readonly string[];
  targetEntityTypes: readonly string[];
  topicSignals: readonly string[];
  cadence: 'ten_minutes' | 'intraday' | 'daily' | 'irregular' | 'annual';
  collection: {
    enabled: boolean;
    minimumIntervalSeconds: number;
    userAgentRequired: boolean;
    canonicalLinkRequired: true;
    fullTextRetention: 'never' | 'review_window_only';
    maxSummaryCharacters: number;
  };
  rights: {
    mode: CommodityNodeCatalogRightsMode;
    publicSnippetAllowed: boolean;
    fullTextRedistributionAllowed: false;
    attributionRequired: true;
    reviewStatus: 'approved' | 'review_required';
    reviewedAt: string;
    reviewedBy: string;
    notes: readonly string[];
  };
  failurePolicy: {
    staleAfterMinutes: number;
    disableAfterConsecutiveFailures: number;
    publicBehavior: 'omit_candidate' | 'retain_last_published_snapshot';
  };
}

const REVIEWED_AT = '2026-07-28T00:00:00Z';
const REVIEWED_BY = 'CommodityNode Data Governance';

/**
 * This is an allowlist, not a crawler seed list. Every entry has a bounded
 * collection contract and may create private candidates only. Nothing here
 * grants permission to publish a claim without exact evidence and review.
 */
export const COMMODITYNODE_SOURCE_CATALOG = [
  {
    id: 'eia-today-in-energy-rss',
    name: 'EIA Today in Energy',
    publisher: 'U.S. Energy Information Administration',
    authority: 'official_analysis',
    transport: 'rss',
    accessUrl: 'https://www.eia.gov/rss/todayinenergy.xml',
    documentationUrl: 'https://www.eia.gov/tools/rssfeeds/',
    termsUrl: 'https://www.eia.gov/about/copyrights_reuse.php',
    targetCommodityIds: ['crude-oil'],
    targetEntityTypes: ['Commodity', 'Refinery', 'Pipeline', 'Port', 'Chokepoint'],
    topicSignals: ['crude oil', 'petroleum', 'refinery', 'inventory', 'production', 'exports'],
    cadence: 'daily',
    collection: {
      enabled: true,
      minimumIntervalSeconds: 900,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'never',
      maxSummaryCharacters: 500,
    },
    rights: {
      mode: 'public_domain_with_exceptions',
      publicSnippetAllowed: true,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'Publish original analysis and link to the EIA record; do not mirror an EIA article.',
        'Exclude separately protected photographs, licensed charts, and third-party materials.',
        'Include EIA attribution and the source publication date.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 2_880,
      disableAfterConsecutiveFailures: 8,
      publicBehavior: 'omit_candidate',
    },
  },
  {
    id: 'eia-press-releases-rss',
    name: 'EIA press releases',
    publisher: 'U.S. Energy Information Administration',
    authority: 'authoritative_primary',
    transport: 'rss',
    accessUrl: 'https://www.eia.gov/rss/press_rss.xml',
    documentationUrl: 'https://www.eia.gov/tools/rssfeeds/',
    termsUrl: 'https://www.eia.gov/about/copyrights_reuse.php',
    targetCommodityIds: ['crude-oil'],
    targetEntityTypes: ['Commodity', 'Refinery', 'Pipeline', 'Port', 'Chokepoint', 'Policy'],
    topicSignals: ['oil supply', 'oil demand', 'production forecast', 'energy disruption'],
    cadence: 'irregular',
    collection: {
      enabled: true,
      minimumIntervalSeconds: 900,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'never',
      maxSummaryCharacters: 500,
    },
    rights: {
      mode: 'public_domain_with_exceptions',
      publicSnippetAllowed: true,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'Use the release as primary evidence only for statements made by EIA.',
        'Exclude separately protected photographs and third-party material.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 10_080,
      disableAfterConsecutiveFailures: 8,
      publicBehavior: 'omit_candidate',
    },
  },
  {
    id: 'usgs-nmic-publications',
    name: 'USGS National Minerals Information Center publications',
    publisher: 'U.S. Geological Survey',
    authority: 'authoritative_primary',
    transport: 'html',
    accessUrl: 'https://www.usgs.gov/national-minerals-information-center',
    documentationUrl: 'https://www.usgs.gov/national-minerals-information-center/data',
    termsUrl: 'https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted',
    targetCommodityIds: ['copper', 'gold'],
    targetEntityTypes: ['Commodity', 'Mine', 'ProcessingPlant', 'Smelter', 'Country'],
    topicSignals: ['production', 'capacity', 'reserves', 'imports', 'exports', 'mine output'],
    cadence: 'annual',
    collection: {
      enabled: true,
      minimumIntervalSeconds: 86_400,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'review_window_only',
      maxSummaryCharacters: 500,
    },
    rights: {
      mode: 'public_domain_with_exceptions',
      publicSnippetAllowed: true,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'Inspect every record for third-party photographs, illustrations, or graphics.',
        'Use exact table, page, and release-version locators for quantitative claims.',
        'Do not use USGS marks in a way that implies endorsement.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 535_680,
      disableAfterConsecutiveFailures: 4,
      publicBehavior: 'retain_last_published_snapshot',
    },
  },
  {
    id: 'usda-fas-cocoa-analysis',
    name: 'USDA FAS cocoa data and GAIN reports',
    publisher: 'U.S. Department of Agriculture Foreign Agricultural Service',
    authority: 'official_analysis',
    transport: 'html',
    accessUrl: 'https://www.fas.usda.gov/data/commodities/chocolate-cocoa-products',
    documentationUrl: 'https://www.fas.usda.gov/data/commodities/chocolate-cocoa-products',
    termsUrl: 'https://www.usda.gov/policies-and-links',
    targetCommodityIds: ['cocoa'],
    targetEntityTypes: ['Commodity', 'Country', 'ProcessingPlant', 'Port', 'TradeRoute'],
    topicSignals: ['cocoa production', 'cocoa exports', 'crop disease', 'weather', 'grindings'],
    cadence: 'irregular',
    collection: {
      enabled: true,
      minimumIntervalSeconds: 21_600,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'review_window_only',
      maxSummaryCharacters: 500,
    },
    rights: {
      mode: 'link_and_fact_extraction_only',
      publicSnippetAllowed: false,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'review_required',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'GAIN reports can mix governmental and non-governmental evidence; classify each underlying claim.',
        'Publish only original summaries with exact report and page locators.',
        'Do not imply that FAS estimates are official statistics of the country discussed.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 43_200,
      disableAfterConsecutiveFailures: 6,
      publicBehavior: 'omit_candidate',
    },
  },
  {
    id: 'usda-nass-news-rss',
    name: 'USDA NASS news releases',
    publisher: 'U.S. Department of Agriculture National Agricultural Statistics Service',
    authority: 'authoritative_primary',
    transport: 'rss',
    accessUrl: 'https://www.nass.usda.gov/rss/news.xml',
    documentationUrl: 'https://data.nass.usda.gov/Newsroom/Syndication/News/index.php',
    termsUrl: 'https://www.usda.gov/policies-and-links',
    targetCommodityIds: ['cocoa'],
    targetEntityTypes: ['Commodity', 'Country', 'Region'],
    topicSignals: ['agricultural statistics', 'crop production', 'stocks', 'acreage'],
    cadence: 'irregular',
    collection: {
      enabled: false,
      minimumIntervalSeconds: 3_600,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'never',
      maxSummaryCharacters: 500,
    },
    rights: {
      mode: 'link_and_fact_extraction_only',
      publicSnippetAllowed: false,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'review_required',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'Disabled for the initial cocoa preset because NASS is not a primary global cocoa-production source.',
        'Retained as an approved catalog candidate for later U.S. agricultural commodities.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 10_080,
      disableAfterConsecutiveFailures: 6,
      publicBehavior: 'omit_candidate',
    },
  },
  {
    id: 'sec-edgar-company-submissions',
    name: 'SEC EDGAR company submissions',
    publisher: 'U.S. Securities and Exchange Commission',
    authority: 'authoritative_primary',
    transport: 'api',
    accessUrl: 'https://data.sec.gov/submissions/CIK0000000000.json',
    documentationUrl: 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
    termsUrl: 'https://www.sec.gov/about/privacy-information',
    targetCommodityIds: ['copper', 'crude-oil', 'gold', 'cocoa'],
    targetEntityTypes: ['Company', 'CompanySegment', 'Mine', 'Refinery', 'ProcessingPlant'],
    topicSignals: ['8-K', '10-Q', '10-K', '20-F', '40-F', '6-K'],
    cadence: 'intraday',
    collection: {
      enabled: true,
      minimumIntervalSeconds: 60,
      userAgentRequired: true,
      canonicalLinkRequired: true,
      fullTextRetention: 'review_window_only',
      maxSummaryCharacters: 0,
    },
    rights: {
      mode: 'public_access_metadata_only',
      publicSnippetAllowed: false,
      fullTextRedistributionAllowed: false,
      attributionRequired: true,
      reviewStatus: 'approved',
      reviewedAt: REVIEWED_AT,
      reviewedBy: REVIEWED_BY,
      notes: [
        'Replace the placeholder CIK only from the reviewed company registry.',
        'Use a declared User-Agent and stay well below the SEC limit of ten requests per second.',
        'A filing is company-primary evidence, not independent confirmation.',
        'Link to the accession record; do not republish complete filings.',
      ],
    },
    failurePolicy: {
      staleAfterMinutes: 1_440,
      disableAfterConsecutiveFailures: 5,
      publicBehavior: 'omit_candidate',
    },
  },
] as const satisfies readonly CommodityNodeSourceCatalogEntry[];

const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const REQUIRED_PRESETS = new Set(['copper', 'crude-oil', 'gold', 'cocoa']);

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[commoditynode-source-catalog] ${message}`);
}

function requireHttps(value: string, field: string): void {
  const url = new URL(value);
  requireCondition(url.protocol === 'https:', `${field} must use HTTPS`);
}

export function validateCommodityNodeSourceCatalog(
  catalog: readonly CommodityNodeSourceCatalogEntry[],
): void {
  const ids = new Set<string>();
  const coveredPresets = new Set<string>();

  for (const entry of catalog) {
    requireCondition(ID.test(entry.id), `${entry.id}: invalid stable id`);
    requireCondition(!ids.has(entry.id), `${entry.id}: duplicate source id`);
    ids.add(entry.id);
    requireHttps(entry.accessUrl, `${entry.id}.accessUrl`);
    requireHttps(entry.documentationUrl, `${entry.id}.documentationUrl`);
    requireHttps(entry.termsUrl, `${entry.id}.termsUrl`);
    requireCondition(entry.targetCommodityIds.length > 0, `${entry.id}: commodity scope is empty`);
    requireCondition(entry.topicSignals.length > 0, `${entry.id}: topic signals are empty`);
    requireCondition(
      entry.collection.minimumIntervalSeconds >= 60,
      `${entry.id}: collection interval is too aggressive`,
    );
    requireCondition(
      entry.collection.maxSummaryCharacters >= 0
        && entry.collection.maxSummaryCharacters <= 500,
      `${entry.id}: summary retention must stay bounded`,
    );
    requireCondition(
      ISO_UTC.test(entry.rights.reviewedAt)
        && Number.isFinite(Date.parse(entry.rights.reviewedAt)),
      `${entry.id}: rights review timestamp is invalid`,
    );
    requireCondition(entry.rights.reviewedBy.trim().length > 0, `${entry.id}: reviewer missing`);
    requireCondition(
      entry.rights.fullTextRedistributionAllowed === false,
      `${entry.id}: source catalog cannot authorize full-text redistribution`,
    );
    if (entry.rights.reviewStatus !== 'approved') {
      requireCondition(
        entry.rights.publicSnippetAllowed === false,
        `${entry.id}: unapproved rights cannot expose snippets`,
      );
    }
    if (entry.collection.enabled) {
      entry.targetCommodityIds.forEach((id) => coveredPresets.add(id));
    }
  }

  for (const preset of REQUIRED_PRESETS) {
    requireCondition(coveredPresets.has(preset), `enabled source coverage missing for ${preset}`);
  }
}
