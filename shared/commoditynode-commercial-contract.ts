export const COMMODITYNODE_COMMERCIAL_CONTRACT_VERSION = 1;

export const COMMODITYNODE_PLANS = {
  public: {
    planId: 'commoditynode_public',
    saleState: 'available',
    price: null,
    entitlements: {
      publishedResearch: true,
      liveMap: true,
      savedEntityLimit: 100,
      alertRuleLimit: 50,
      historicalReplayDays: 0,
      graphExportFormats: [] as string[],
      advancedPathMaxHops: 3,
      apiDailyRequests: 100,
      apiMinuteBurst: 10,
      mcpReadTools: true,
    },
  },
  professionalCandidate: {
    planId: 'commoditynode_professional',
    saleState: 'not_for_sale',
    price: null,
    entitlements: {
      publishedResearch: true,
      liveMap: true,
      savedEntityLimit: 100,
      alertRuleLimit: 50,
      historicalReplayDays: 3650,
      graphExportFormats: ['json', 'csv', 'png'],
      advancedPathMaxHops: 6,
      apiDailyRequests: 10_000,
      apiMinuteBurst: 120,
      mcpReadTools: true,
    },
  },
} as const;

export const COMMODITYNODE_API_SCOPES = {
  public: [
    'commodity.events.read',
    'commodity.benchmarks.read',
    'commodity.routes.read',
    'commodity.evidence.read',
  ],
  paidCandidate: [
    'commodity.history.read',
    'commodity.graph.export',
    'commodity.paths.advanced',
  ],
} as const;

export interface CommodityNodeCheckoutGates {
  productFactsVerified: boolean;
  paidFeaturesEndToEndTested: boolean;
  legalTermsPublished: boolean;
  privacyRuntimeVerified: boolean;
  refundAndSupportOwnerAssigned: boolean;
  productionWebhookReconciled: boolean;
}

export const COMMODITYNODE_CHECKOUT_GATES: CommodityNodeCheckoutGates = {
  productFactsVerified: false,
  paidFeaturesEndToEndTested: false,
  legalTermsPublished: false,
  privacyRuntimeVerified: false,
  refundAndSupportOwnerAssigned: false,
  productionWebhookReconciled: false,
};

export function commodityNodeCheckoutActivation(
  gates: CommodityNodeCheckoutGates,
): { enabled: boolean; blockers: Array<keyof CommodityNodeCheckoutGates> } {
  const blockers = (
    Object.entries(gates) as Array<
      [keyof CommodityNodeCheckoutGates, boolean]
    >
  )
    .filter(([, passed]) => !passed)
    .map(([gate]) => gate);
  return { enabled: blockers.length === 0, blockers };
}

export function validateCommodityNodeCommercialContract(): string[] {
  const issues: string[] = [];
  const publicPlan = COMMODITYNODE_PLANS.public;
  const paidPlan = COMMODITYNODE_PLANS.professionalCandidate;
  if (paidPlan.saleState !== 'not_for_sale') {
    issues.push('Professional candidate must remain not_for_sale until checkout gates pass.');
  }
  if (paidPlan.price !== null) {
    issues.push('A price cannot be published before commercial approval.');
  }
  if (paidPlan.entitlements.advancedPathMaxHops <= publicPlan.entitlements.advancedPathMaxHops) {
    issues.push('Advanced path entitlement must exceed the public path depth.');
  }
  if (paidPlan.entitlements.apiDailyRequests <= publicPlan.entitlements.apiDailyRequests) {
    issues.push('Paid API daily quota must exceed the public quota.');
  }
  if (new Set([
    ...COMMODITYNODE_API_SCOPES.public,
    ...COMMODITYNODE_API_SCOPES.paidCandidate,
  ]).size !== (
    COMMODITYNODE_API_SCOPES.public.length
    + COMMODITYNODE_API_SCOPES.paidCandidate.length
  )) {
    issues.push('API scopes must be unique across tiers.');
  }
  return issues;
}
