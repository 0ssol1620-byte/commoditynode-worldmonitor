import {
  COBRE_PANAMA_GRAPH_SNAPSHOT,
  COBRE_PANAMA_IMPACT_EVENT,
} from '../../shared/commoditynode-cobre-panama-impact';
import {
  validateGraphSnapshot,
  type CommodityEntity,
  type GraphSnapshot,
  type ImpactEvidence,
  type ImpactPath,
  type PublishedImpactEdge,
} from '../../shared/commodity-impact-ontology';
import {
  resolveCommodityNodeEntity,
  type CommodityNodeEntityResolution,
} from '../../shared/commoditynode-entity-resolution';
import { findImpactPaths } from '../../src/services/commodity-impact-graph';

export interface CommodityNodeSubgraph {
  snapshotId: string;
  rootEntityId: string;
  entities: readonly CommodityEntity[];
  edges: readonly PublishedImpactEdge[];
  evidence: readonly ImpactEvidence[];
  truncated: boolean;
  limits: { maxHops: number; maxNodes: number; maxEdges: number };
}

const SNAPSHOTS = new Map<string, GraphSnapshot>([
  [COBRE_PANAMA_GRAPH_SNAPSHOT.id, COBRE_PANAMA_GRAPH_SNAPSHOT],
]);

const snapshotIssues = validateGraphSnapshot(COBRE_PANAMA_GRAPH_SNAPSHOT);
if (snapshotIssues.length > 0) {
  throw new Error(
    `[commoditynode-impact-graph] invalid published snapshot: ${snapshotIssues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ')}`,
  );
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export function getCommodityNodeGraphSnapshot(
  snapshotId = COBRE_PANAMA_GRAPH_SNAPSHOT.id,
): GraphSnapshot | null {
  return SNAPSHOTS.get(snapshotId) ?? null;
}

export function resolveCommodityNodeGraphEntity(
  value: string,
  snapshotId?: string,
): CommodityNodeEntityResolution {
  const snapshot = getCommodityNodeGraphSnapshot(snapshotId);
  if (!snapshot) {
    return { status: 'unresolved', normalizedInput: '', entity: null, candidates: [] };
  }
  return resolveCommodityNodeEntity(value, snapshot.entities);
}

export function getCommodityNodeSubgraph(options: {
  root: string;
  snapshotId?: string;
  maxHops?: number;
  maxNodes?: number;
  maxEdges?: number;
}): CommodityNodeSubgraph | null {
  const snapshot = getCommodityNodeGraphSnapshot(options.snapshotId);
  if (!snapshot) return null;
  const resolution = resolveCommodityNodeEntity(options.root, snapshot.entities);
  if (resolution.status !== 'resolved' || !resolution.entity) return null;

  const maxHops = boundedInteger(options.maxHops, 2, 0, 3);
  const maxNodes = boundedInteger(options.maxNodes, 24, 1, 50);
  const maxEdges = boundedInteger(options.maxEdges, 48, 0, 100);
  const entityIds = new Set<string>([resolution.entity.id]);
  const edges: PublishedImpactEdge[] = [];
  let frontier = [resolution.entity.id];
  let truncated = false;

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop += 1) {
    const next: string[] = [];
    for (const entityId of frontier) {
      const incident = snapshot.edges.filter(
        (edge) => edge.sourceEntityId === entityId || edge.targetEntityId === entityId,
      );
      for (const edge of incident) {
        if (edges.some((candidate) => candidate.id === edge.id)) continue;
        if (edges.length >= maxEdges) {
          truncated = true;
          continue;
        }
        const neighbor =
          edge.sourceEntityId === entityId ? edge.targetEntityId : edge.sourceEntityId;
        if (!entityIds.has(neighbor) && entityIds.size >= maxNodes) {
          truncated = true;
          continue;
        }
        edges.push(edge);
        if (!entityIds.has(neighbor)) {
          entityIds.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }

  const entities = snapshot.entities.filter((entity) => entityIds.has(entity.id));
  const evidenceIds = new Set(edges.flatMap((edge) => [...edge.evidenceIds]));
  const evidence = snapshot.evidence.filter((item) => evidenceIds.has(item.id));
  return {
    snapshotId: snapshot.id,
    rootEntityId: resolution.entity.id,
    entities,
    edges,
    evidence,
    truncated,
    limits: { maxHops, maxNodes, maxEdges },
  };
}

export function getCommodityNodeImpactPaths(options: {
  target: string;
  snapshotId?: string;
  maxHops?: number;
}): readonly ImpactPath[] | null {
  const snapshot = getCommodityNodeGraphSnapshot(options.snapshotId);
  if (!snapshot) return null;
  const target = resolveCommodityNodeEntity(options.target, snapshot.entities);
  if (target.status !== 'resolved' || !target.entity) return null;
  const maxHops = boundedInteger(options.maxHops, 3, 1, 3) as 1 | 2 | 3;
  return findImpactPaths(snapshot, COBRE_PANAMA_IMPACT_EVENT, target.entity.id, {
    maxHops,
    now: snapshot.createdAt,
  });
}

export function getCommodityNodeGraphEvidence(
  id: string,
  snapshotId?: string,
): {
  edge: PublishedImpactEdge | null;
  entity: CommodityEntity | null;
  evidence: readonly ImpactEvidence[];
} | null {
  const snapshot = getCommodityNodeGraphSnapshot(snapshotId);
  if (!snapshot) return null;
  const edge = snapshot.edges.find((item) => item.id === id) ?? null;
  const entity = snapshot.entities.find((item) => item.id === id) ?? null;
  const directEvidence = snapshot.evidence.find((item) => item.id === id) ?? null;
  if (!edge && !entity && !directEvidence) return null;
  const evidenceIds = new Set(edge?.evidenceIds ?? []);
  return {
    edge,
    entity,
    evidence: directEvidence
      ? [directEvidence]
      : snapshot.evidence.filter((item) => evidenceIds.has(item.id)),
  };
}
