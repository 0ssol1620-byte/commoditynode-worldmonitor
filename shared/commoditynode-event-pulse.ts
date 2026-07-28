export type CommodityEventMateriality = 'minor' | 'notable' | 'material' | 'critical';
export type CommodityEventPublicationState =
  | 'candidate'
  | 'reviewed'
  | 'published'
  | 'superseded'
  | 'expired'
  | 'rejected';
export type CommodityEventEvidenceKind = 'authoritative_primary' | 'company_primary' | 'independent_secondary';

export interface CommodityEventEvidence {
  id: string;
  url: string;
  publisher: string;
  kind: CommodityEventEvidenceKind;
  locator: string;
  supportsClaims: string[];
}

export interface CommodityEventPublicationInput {
  status: CommodityEventPublicationState;
  isFixture: boolean;
  materiality: CommodityEventMateriality;
  occurredAt: Date | string;
  publishedAt?: Date | string;
  reviewedAt?: Date | string;
  reviewedBy?: string;
  claims: Array<{ id: string; evidenceIds: string[] }>;
  evidence: CommodityEventEvidence[];
  unknowns: string[];
}

export interface CommodityEventPublicationDecision {
  publishable: boolean;
  reasons: string[];
  sourceHosts: string[];
  hasAuthoritativePrimary: boolean;
}

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'source',
  'utm_campaign',
  'utm_content',
  'utm_medium',
  'utm_source',
  'utm_term',
]);

export function canonicalizeCommodityEventUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  url.searchParams.sort();
  return url.toString();
}

export function normalizeCommodityEventTitle(input: string): string {
  return input
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function commodityEventFingerprint(input: {
  title: string;
  occurredAt: Date | string;
  commodityIds: string[];
  entityIds: string[];
  locationId: string;
}): string {
  const day = new Date(input.occurredAt).toISOString().slice(0, 10);
  const canonical = [
    day,
    normalizeCommodityEventTitle(input.title),
    [...input.commodityIds].sort().join(','),
    [...input.entityIds].sort().join(','),
    input.locationId.trim().toLocaleLowerCase('en-US'),
  ].join('|');
  return `cne_${fnv1a32(canonical)}`;
}

export function evaluateCommodityEventPublication(
  input: CommodityEventPublicationInput,
): CommodityEventPublicationDecision {
  const reasons: string[] = [];
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item]));
  const sourceHosts = [
    ...new Set(
      input.evidence.map((item) => new URL(canonicalizeCommodityEventUrl(item.url)).hostname),
    ),
  ].sort();
  const hasAuthoritativePrimary = input.evidence.some(
    (item) => item.kind === 'authoritative_primary',
  );

  if (input.status !== 'published') reasons.push('publication_state_not_published');
  if (input.isFixture) reasons.push('fixture_cannot_be_published');
  if (!input.publishedAt) reasons.push('publication_date_missing');
  if (!input.reviewedBy?.trim() || !input.reviewedAt) reasons.push('review_record_missing');
  if (!Number.isFinite(new Date(input.occurredAt).valueOf())) reasons.push('invalid_event_date');
  if (input.evidence.length === 0) reasons.push('evidence_missing');
  if (input.claims.length === 0) reasons.push('claims_missing');
  if (input.unknowns.length === 0) reasons.push('unknowns_not_recorded');

  for (const claim of input.claims) {
    if (claim.evidenceIds.length === 0) {
      reasons.push(`claim_without_evidence:${claim.id}`);
      continue;
    }
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceById.has(evidenceId)) {
        reasons.push(`claim_unknown_evidence:${claim.id}:${evidenceId}`);
      }
    }
  }

  if (
    (input.materiality === 'material' || input.materiality === 'critical') &&
    !hasAuthoritativePrimary &&
    sourceHosts.length < 2
  ) {
    reasons.push('high_materiality_needs_primary_or_source_diversity');
  }

  return {
    publishable: reasons.length === 0,
    reasons,
    sourceHosts,
    hasAuthoritativePrimary,
  };
}
