export const COMMODITY_ONTOLOGY_VERSION = 'commodity-impact-ontology/v1' as const;

export const COMMODITY_ENTITY_TYPES = [
  'Commodity',
  'Benchmark',
  'FinancialInstrument',
  'Country',
  'Region',
  'Mine',
  'ProcessingPlant',
  'Refinery',
  'Smelter',
  'Port',
  'Chokepoint',
  'TradeRoute',
  'StorageFacility',
  'Pipeline',
  'Company',
  'CompanySegment',
  'Industry',
  'FinalProduct',
  'Policy',
  'WeatherHazard',
  'Event',
  'Source',
] as const;

export type CommodityEntityType = (typeof COMMODITY_ENTITY_TYPES)[number];

export const COMMODITY_RELATION_TYPES = [
  'produces',
  'processes',
  'refines',
  'owns',
  'operates',
  'ships_through',
  'exports_to',
  'imports_from',
  'supplies',
  'consumes',
  'uses_as_input',
  'depends_on',
  'substitutes_for',
  'hedges',
  'passes_through_cost',
  'exposed_to',
  'benefits_from',
  'disrupted_by',
  'regulated_by',
  'located_in',
  'reported_by',
  'supported_by_claim',
] as const;

export type CommodityRelationType = (typeof COMMODITY_RELATION_TYPES)[number];

export const IMPACT_EDGE_STATUSES = [
  'candidate',
  'reviewed',
  'published',
  'superseded',
  'rejected',
] as const;

export type ImpactEdgeStatus = (typeof IMPACT_EDGE_STATUSES)[number];
export type ImpactDirection = 'positive' | 'negative' | 'mixed' | 'conditional';
export type ImpactDirectness = 'direct' | 'indirect';
export type ImpactStrengthBand = 'low' | 'medium' | 'high';
export type ImpactConfidenceBand = 'limited' | 'moderate' | 'strong';
export type ImpactMaterialityBand = 'minor' | 'notable' | 'material' | 'critical';
export type ImpactPathRelevance = 'exploratory' | 'moderate' | 'high';

export interface CommodityEntity {
  id: string;
  type: CommodityEntityType;
  name: string;
  aliases: readonly string[];
  description?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface ImpactEvidence {
  id: string;
  claimId: string;
  sourceEntityId: string;
  sourceUrl: string;
  sourceTitle: string;
  publisher: string;
  publishedAt?: string;
  retrievedAt: string;
  locator: string;
  evidenceType:
    | 'official_primary'
    | 'company_primary'
    | 'market_data'
    | 'independent_secondary'
    | 'internal_fixture';
  supports: boolean;
  note?: string;
}

interface ImpactEdgeCore {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: CommodityRelationType;
  direction: ImpactDirection;
  directness: ImpactDirectness;
  strengthBand: ImpactStrengthBand;
  confidenceBand: ImpactConfidenceBand;
  lagMinDays?: number;
  lagMaxDays?: number;
  condition?: string;
  invalidation?: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  validFrom?: string;
  validUntil?: string;
}

export interface DraftImpactEdge extends ImpactEdgeCore {
  status: 'candidate';
  proposedBy: string;
  proposedAt: string;
}

export interface ReviewedImpactEdge extends ImpactEdgeCore {
  status: 'reviewed';
  reviewedBy: string;
  reviewedAt: string;
}

export interface PublishedImpactEdge extends ImpactEdgeCore {
  status: 'published';
  reviewedBy: string;
  reviewedAt: string;
  publishedAt: string;
}

export interface ClosedImpactEdge extends ImpactEdgeCore {
  status: 'superseded' | 'rejected';
  reviewedBy: string;
  reviewedAt: string;
  closedAt: string;
  closureReason: string;
  supersededBy?: string;
}

export type ImpactEdge =
  | DraftImpactEdge
  | ReviewedImpactEdge
  | PublishedImpactEdge
  | ClosedImpactEdge;

export interface CommodityImpactEvent {
  id: string;
  name: string;
  occurredAt: string;
  expiresAt?: string;
  locationEntityIds: readonly string[];
  affectedEntityIds: readonly string[];
  materiality: ImpactMaterialityBand;
  materialityRationale: string;
  evidenceIds: readonly string[];
  status: 'candidate' | 'reviewed' | 'published' | 'expired' | 'rejected';
  isFixture?: boolean;
}

export interface GraphSnapshot {
  id: string;
  ontologyVersion: typeof COMMODITY_ONTOLOGY_VERSION;
  createdAt: string;
  rootEntityId: string;
  eventId?: string;
  entities: readonly CommodityEntity[];
  edges: readonly PublishedImpactEdge[];
  evidence: readonly ImpactEvidence[];
}

export interface ImpactPath {
  id: string;
  eventId: string;
  entityIds: readonly string[];
  edgeIds: readonly string[];
  score: number;
  relevance: ImpactPathRelevance;
  warnings: readonly string[];
  explanation: readonly string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const isIsoDate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(value)
  && Number.isFinite(Date.parse(value));

export function validatePublishedImpactEdge(edge: PublishedImpactEdge): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!edge.id.trim()) issues.push({ path: 'id', message: 'Edge id is required.' });
  if (!edge.sourceEntityId.trim()) {
    issues.push({ path: 'sourceEntityId', message: 'Source entity id is required.' });
  }
  if (!edge.targetEntityId.trim()) {
    issues.push({ path: 'targetEntityId', message: 'Target entity id is required.' });
  }
  if (edge.sourceEntityId === edge.targetEntityId) {
    issues.push({ path: 'targetEntityId', message: 'Self-referential edges are not publishable.' });
  }
  if (!COMMODITY_RELATION_TYPES.includes(edge.relationType)) {
    issues.push({ path: 'relationType', message: 'Unknown relation type.' });
  }
  if (edge.claimIds.length === 0) {
    issues.push({ path: 'claimIds', message: 'A published edge requires at least one claim.' });
  }
  if (edge.evidenceIds.length === 0) {
    issues.push({ path: 'evidenceIds', message: 'A published edge requires evidence.' });
  }
  if (!edge.reviewedBy.trim()) {
    issues.push({ path: 'reviewedBy', message: 'Reviewer identity is required.' });
  }
  if (!isIsoDate(edge.reviewedAt)) {
    issues.push({ path: 'reviewedAt', message: 'Reviewer timestamp must be ISO-8601.' });
  }
  if (!isIsoDate(edge.publishedAt)) {
    issues.push({ path: 'publishedAt', message: 'Publication timestamp must be ISO-8601.' });
  }
  if (edge.lagMinDays !== undefined && edge.lagMinDays < 0) {
    issues.push({ path: 'lagMinDays', message: 'Minimum lag cannot be negative.' });
  }
  if (edge.lagMaxDays !== undefined && edge.lagMaxDays < 0) {
    issues.push({ path: 'lagMaxDays', message: 'Maximum lag cannot be negative.' });
  }
  if (
    edge.lagMinDays !== undefined
    && edge.lagMaxDays !== undefined
    && edge.lagMinDays > edge.lagMaxDays
  ) {
    issues.push({ path: 'lagMaxDays', message: 'Maximum lag must be at least minimum lag.' });
  }
  if (edge.direction === 'conditional' && !edge.condition?.trim()) {
    issues.push({ path: 'condition', message: 'Conditional edges must state their condition.' });
  }
  return issues;
}

export function validateGraphSnapshot(snapshot: GraphSnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const entityIds = new Set<string>();
  const evidenceIds = new Set<string>();
  const claimIds = new Set<string>();

  for (const [index, entity] of snapshot.entities.entries()) {
    if (entityIds.has(entity.id)) {
      issues.push({ path: `entities[${index}].id`, message: 'Entity ids must be unique.' });
    }
    entityIds.add(entity.id);
  }
  for (const [index, evidence] of snapshot.evidence.entries()) {
    if (evidenceIds.has(evidence.id)) {
      issues.push({ path: `evidence[${index}].id`, message: 'Evidence ids must be unique.' });
    }
    evidenceIds.add(evidence.id);
    claimIds.add(evidence.claimId);
  }
  if (!entityIds.has(snapshot.rootEntityId)) {
    issues.push({ path: 'rootEntityId', message: 'Snapshot root must reference an entity.' });
  }
  for (const [index, edge] of snapshot.edges.entries()) {
    for (const issue of validatePublishedImpactEdge(edge)) {
      issues.push({ path: `edges[${index}].${issue.path}`, message: issue.message });
    }
    if (!entityIds.has(edge.sourceEntityId)) {
      issues.push({ path: `edges[${index}].sourceEntityId`, message: 'Unknown source entity.' });
    }
    if (!entityIds.has(edge.targetEntityId)) {
      issues.push({ path: `edges[${index}].targetEntityId`, message: 'Unknown target entity.' });
    }
    for (const evidenceId of edge.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push({ path: `edges[${index}].evidenceIds`, message: `Unknown evidence ${evidenceId}.` });
      }
    }
    for (const claimId of edge.claimIds) {
      if (!claimIds.has(claimId)) {
        issues.push({ path: `edges[${index}].claimIds`, message: `Claim ${claimId} has no evidence.` });
      }
    }
  }
  return issues;
}
