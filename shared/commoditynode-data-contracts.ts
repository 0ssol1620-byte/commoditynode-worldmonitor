export type CommodityNodeSourceCategory =
  | 'market_quote'
  | 'official_statistics'
  | 'official_research'
  | 'news'
  | 'filing'
  | 'geospatial'
  | 'media';

export type CommodityNodeRightsStatus =
  | 'approved'
  | 'review_required'
  | 'restricted'
  | 'expired'
  | 'rejected';

export type CommodityNodeCadence =
  | 'realtime'
  | 'intraday'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'irregular';

export interface CommodityNodeRightsContract {
  status: CommodityNodeRightsStatus;
  license: string | null;
  termsUrl: string;
  reviewedAt: string;
  reviewedBy: string;
  expiresAt: string | null;
  publicDisplay: boolean;
  redistribution: boolean;
  derivativeWorks: boolean;
  commercialUse: boolean;
  attributionRequired: boolean;
  restrictions: readonly string[];
  thirdPartyCaveat: string | null;
}

export interface CommodityNodeDataSource {
  id: string;
  name: string;
  publisher: string;
  category: CommodityNodeSourceCategory;
  homepageUrl: string;
  accessUrl: string;
  cadence: CommodityNodeCadence;
  transport: 'api' | 'download' | 'html' | 'rss' | 'manual';
  attribution: string;
  editorialOwner: string;
  operationalOwner: string;
  rights: CommodityNodeRightsContract;
}

export type CommodityNodeInstrumentType =
  | 'futures_benchmark'
  | 'spot_assessment'
  | 'official_series'
  | 'physical_proxy'
  | 'equity_proxy'
  | 'index';

export interface CommodityNodeBenchmarkContract {
  id: string;
  commodityId: string;
  name: string;
  providerSymbol: string;
  instrumentType: CommodityNodeInstrumentType;
  exchange: string | null;
  currency: string;
  unit: string;
  sourceId: string;
  delayPolicy: string;
  proxySemantics: string;
  caveat: string;
  publicDisplayRequiresRightsApproval: true;
}

export interface CommodityNodeSourceLocator {
  url: string;
  retrievedAt: string;
  locatorType: 'section' | 'page' | 'table' | 'row' | 'query' | 'fragment' | 'full_record';
  exactLocator: string;
}

export interface CommodityNodeSourceRecord {
  id: string;
  sourceId: string;
  title: string;
  publisher: string;
  locator: CommodityNodeSourceLocator;
  contentHash: string | null;
  archivedUrl: string | null;
  reviewedAt: string;
  reviewedBy: string;
}

export interface CommodityNodeClaim {
  id: string;
  subjectId: string;
  statement: string;
  status: 'candidate' | 'reviewed' | 'published' | 'superseded' | 'rejected';
  sourceRecordIds: readonly string[];
  validFrom: string;
  validTo: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  supersedesClaimId: string | null;
}

export interface CommodityNodeRightsLedgerEntry {
  id: string;
  assetType: 'dataset' | 'media_asset';
  assetId: string;
  sourceId: string;
  rights: CommodityNodeRightsContract;
  evidenceRecordIds: readonly string[];
}

export type CommodityNodeFreshnessStatus =
  | 'fresh'
  | 'stale'
  | 'expired'
  | 'partial'
  | 'unavailable';

export interface CommodityNodeFreshnessEnvelope<T> {
  data: T | null;
  sourceId: string;
  asOf: string | null;
  fetchedAt: string;
  staleAt: string;
  expiresAt: string;
  status: CommodityNodeFreshnessStatus;
  reason: string | null;
}

export type CommodityNodePublicationScope = 'dataset' | 'module' | 'page';
export type CommodityNodePublicationBlocker =
  | 'rights_not_approved'
  | 'rights_expired'
  | 'missing_evidence'
  | 'not_reviewed'
  | 'expired_data'
  | 'unavailable_data'
  | 'private_record';

export interface CommodityNodePublicationContract {
  id: string;
  scope: CommodityNodePublicationScope;
  state: 'candidate' | 'reviewed' | 'published' | 'superseded' | 'rejected';
  sourceIds: readonly string[];
  evidenceRecordIds: readonly string[];
  reviewedAt: string | null;
  reviewedBy: string | null;
  visibility: 'public' | 'private';
  allowStaleWithDisclosure: boolean;
}

export interface CommodityNodePublicationDecision {
  publishable: boolean;
  blockers: readonly CommodityNodePublicationBlocker[];
  disclosureRequired: boolean;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[commoditynode-data-contract] ${message}`);
}

function assertIsoDateTime(value: string, field: string): void {
  assert(ISO_DATE_TIME.test(value) && Number.isFinite(Date.parse(value)), `${field} must be an ISO UTC timestamp`);
}

function assertUrl(value: string, field: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`[commoditynode-data-contract] ${field} must be an absolute URL`);
  }
  assert(url.protocol === 'https:', `${field} must use HTTPS`);
}

export function validateCommodityNodeDataSource(source: CommodityNodeDataSource): void {
  assert(ID.test(source.id), 'source id must be stable lowercase ASCII');
  assert(source.name.trim().length > 0, `${source.id}: name is required`);
  assert(source.publisher.trim().length > 0, `${source.id}: publisher is required`);
  assert(source.editorialOwner.trim().length > 0, `${source.id}: editorial owner is required`);
  assert(source.operationalOwner.trim().length > 0, `${source.id}: operational owner is required`);
  assert(source.attribution.trim().length > 0, `${source.id}: attribution is required`);
  assertUrl(source.homepageUrl, `${source.id}.homepageUrl`);
  assertUrl(source.accessUrl, `${source.id}.accessUrl`);
  assertUrl(source.rights.termsUrl, `${source.id}.rights.termsUrl`);
  assertIsoDateTime(source.rights.reviewedAt, `${source.id}.rights.reviewedAt`);
  if (source.rights.expiresAt) {
    assertIsoDateTime(source.rights.expiresAt, `${source.id}.rights.expiresAt`);
  }
  if (source.rights.status !== 'approved') {
    assert(
      !source.rights.publicDisplay || source.rights.restrictions.length > 0,
      `${source.id}: non-approved rights must not silently allow public display`,
    );
  }
  if (source.rights.redistribution) {
    assert(source.rights.publicDisplay, `${source.id}: redistribution requires public display rights`);
  }
}

export function validateCommodityNodeDataSourceRegistry(
  sources: readonly CommodityNodeDataSource[],
): void {
  const ids = new Set<string>();
  for (const source of sources) {
    validateCommodityNodeDataSource(source);
    assert(!ids.has(source.id), `duplicate source id ${source.id}`);
    ids.add(source.id);
  }
}

export function validateCommodityNodeBenchmarkContract(
  benchmark: CommodityNodeBenchmarkContract,
  sourceIds: ReadonlySet<string>,
): void {
  assert(ID.test(benchmark.id), 'benchmark id must be stable lowercase ASCII');
  assert(ID.test(benchmark.commodityId), `${benchmark.id}: commodity id is invalid`);
  assert(benchmark.name.trim().length > 0, `${benchmark.id}: name is required`);
  assert(benchmark.providerSymbol.trim().length > 0, `${benchmark.id}: provider symbol is required`);
  assert(benchmark.currency.trim().length === 3, `${benchmark.id}: currency must be an ISO-style code`);
  assert(benchmark.unit.trim().length > 0, `${benchmark.id}: unit is required`);
  assert(sourceIds.has(benchmark.sourceId), `${benchmark.id}: unknown source ${benchmark.sourceId}`);
  assert(benchmark.delayPolicy.trim().length > 0, `${benchmark.id}: delay policy is required`);
  assert(benchmark.proxySemantics.trim().length > 0, `${benchmark.id}: proxy semantics are required`);
  assert(benchmark.caveat.trim().length > 0, `${benchmark.id}: caveat is required`);
}

export function validateCommodityNodeSourceRecord(
  record: CommodityNodeSourceRecord,
  sourceIds: ReadonlySet<string>,
): void {
  assert(ID.test(record.id), 'source record id must be stable lowercase ASCII');
  assert(sourceIds.has(record.sourceId), `${record.id}: unknown source ${record.sourceId}`);
  assertUrl(record.locator.url, `${record.id}.locator.url`);
  assertIsoDateTime(record.locator.retrievedAt, `${record.id}.locator.retrievedAt`);
  assert(record.locator.exactLocator.trim().length > 0, `${record.id}: exact locator is required`);
  assertIsoDateTime(record.reviewedAt, `${record.id}.reviewedAt`);
}

export function validateCommodityNodeClaim(
  claim: CommodityNodeClaim,
  sourceRecordIds: ReadonlySet<string>,
): void {
  assert(ID.test(claim.id), 'claim id must be stable lowercase ASCII');
  assert(claim.statement.trim().length >= 20, `${claim.id}: claim statement is too short`);
  assert(claim.sourceRecordIds.length > 0, `${claim.id}: at least one source record is required`);
  for (const sourceRecordId of claim.sourceRecordIds) {
    assert(sourceRecordIds.has(sourceRecordId), `${claim.id}: unknown source record ${sourceRecordId}`);
  }
  assertIsoDateTime(claim.validFrom, `${claim.id}.validFrom`);
  if (claim.validTo) assertIsoDateTime(claim.validTo, `${claim.id}.validTo`);
  if (claim.status === 'reviewed' || claim.status === 'published') {
    assert(claim.reviewedAt && claim.reviewedBy, `${claim.id}: reviewed claims require reviewer metadata`);
  }
}

export function createCommodityNodeFreshnessEnvelope<T>(input: {
  data: T | null;
  sourceId: string;
  asOf: string | null;
  fetchedAt: string;
  staleAt: string;
  expiresAt: string;
  now: string;
  partial?: boolean;
  reason?: string | null;
}): CommodityNodeFreshnessEnvelope<T> {
  for (const [field, value] of [
    ['fetchedAt', input.fetchedAt],
    ['staleAt', input.staleAt],
    ['expiresAt', input.expiresAt],
    ['now', input.now],
  ] as const) {
    assertIsoDateTime(value, field);
  }
  if (input.asOf) assertIsoDateTime(input.asOf, 'asOf');
  assert(Date.parse(input.fetchedAt) <= Date.parse(input.staleAt), 'fetchedAt must not follow staleAt');
  assert(Date.parse(input.staleAt) <= Date.parse(input.expiresAt), 'staleAt must not follow expiresAt');

  const now = Date.parse(input.now);
  let status: CommodityNodeFreshnessStatus;
  if (input.data === null) status = 'unavailable';
  else if (input.partial) status = 'partial';
  else if (now >= Date.parse(input.expiresAt)) status = 'expired';
  else if (now >= Date.parse(input.staleAt)) status = 'stale';
  else status = 'fresh';

  return {
    data: input.data,
    sourceId: input.sourceId,
    asOf: input.asOf,
    fetchedAt: input.fetchedAt,
    staleAt: input.staleAt,
    expiresAt: input.expiresAt,
    status,
    reason: input.reason ?? null,
  };
}

export function evaluateCommodityNodePublication(input: {
  contract: CommodityNodePublicationContract;
  sources: readonly CommodityNodeDataSource[];
  freshness: readonly CommodityNodeFreshnessEnvelope<unknown>[];
  now: string;
}): CommodityNodePublicationDecision {
  assertIsoDateTime(input.now, 'publication.now');
  const sourceById = new Map(input.sources.map((source) => [source.id, source]));
  const blockers = new Set<CommodityNodePublicationBlocker>();

  if (input.contract.visibility !== 'public') blockers.add('private_record');
  if (input.contract.state !== 'reviewed' && input.contract.state !== 'published') {
    blockers.add('not_reviewed');
  }
  if (!input.contract.reviewedAt || !input.contract.reviewedBy) blockers.add('not_reviewed');
  if (input.contract.evidenceRecordIds.length === 0) blockers.add('missing_evidence');

  for (const sourceId of input.contract.sourceIds) {
    const source = sourceById.get(sourceId);
    if (!source || source.rights.status !== 'approved' || !source.rights.publicDisplay) {
      blockers.add('rights_not_approved');
      continue;
    }
    if (source.rights.expiresAt && Date.parse(source.rights.expiresAt) <= Date.parse(input.now)) {
      blockers.add('rights_expired');
    }
  }

  let disclosureRequired = false;
  for (const envelope of input.freshness) {
    if (envelope.status === 'unavailable') blockers.add('unavailable_data');
    if (envelope.status === 'expired') blockers.add('expired_data');
    if (envelope.status === 'stale' || envelope.status === 'partial') {
      if (input.contract.allowStaleWithDisclosure) disclosureRequired = true;
      else blockers.add('expired_data');
    }
  }

  return {
    publishable: blockers.size === 0,
    blockers: [...blockers].sort(),
    disclosureRequired,
  };
}
