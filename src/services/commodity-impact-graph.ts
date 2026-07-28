import {
  type CommodityImpactEvent,
  type GraphSnapshot,
  type ImpactConfidenceBand,
  type ImpactPath,
  type ImpactPathRelevance,
  type ImpactStrengthBand,
  type PublishedImpactEdge,
} from '../../shared/commodity-impact-ontology.js';

const STRENGTH_WEIGHT: Record<ImpactStrengthBand, number> = {
  low: 0.45,
  medium: 0.7,
  high: 0.9,
};

const CONFIDENCE_WEIGHT: Record<ImpactConfidenceBand, number> = {
  limited: 0.5,
  moderate: 0.72,
  strong: 0.9,
};

const MATERIALITY_WEIGHT: Record<CommodityImpactEvent['materiality'], number> = {
  minor: 0.35,
  notable: 0.55,
  material: 0.78,
  critical: 1,
};

export interface ImpactPathOptions {
  maxHops?: 1 | 2 | 3;
  hopDecay?: number;
  timeDecay?: number;
  relevanceToSelectedCommodity?: number;
  now?: string;
}

function relevanceBand(score: number): ImpactPathRelevance {
  if (score >= 0.42) return 'high';
  if (score >= 0.18) return 'moderate';
  return 'exploratory';
}

function edgeExplanation(edge: PublishedImpactEdge): string {
  const lag =
    edge.lagMinDays === undefined
      ? 'lag not estimated'
      : edge.lagMaxDays === undefined || edge.lagMinDays === edge.lagMaxDays
        ? `${edge.lagMinDays} day lag`
        : `${edge.lagMinDays}–${edge.lagMaxDays} day lag`;
  return `${edge.relationType.replace(/_/g, ' ')} · ${edge.direction} · ${edge.strengthBand} strength · ${edge.confidenceBand} evidence · ${lag}`;
}

function edgeIsCurrent(edge: PublishedImpactEdge, now: number): boolean {
  if (edge.validFrom && Date.parse(edge.validFrom) > now) return false;
  if (edge.validUntil && Date.parse(edge.validUntil) < now) return false;
  return true;
}

export function scoreImpactPath(
  event: CommodityImpactEvent,
  edges: readonly PublishedImpactEdge[],
  options: ImpactPathOptions = {},
): Pick<ImpactPath, 'score' | 'relevance' | 'warnings' | 'explanation'> {
  const hopDecay = Math.min(1, Math.max(0, options.hopDecay ?? 0.78));
  const timeDecay = Math.min(1, Math.max(0, options.timeDecay ?? 1));
  const commodityRelevance = Math.min(
    1,
    Math.max(0, options.relevanceToSelectedCommodity ?? 1),
  );
  let score = MATERIALITY_WEIGHT[event.materiality] * timeDecay * commodityRelevance;
  const warnings: string[] = [];
  const explanation = [
    `Event materiality: ${event.materiality}`,
    ...edges.map(edgeExplanation),
    `Hop decay: ${hopDecay.toFixed(2)} across ${Math.max(0, edges.length - 1)} additional hops`,
  ];

  const evidenceIds = new Set<string>();
  for (const edge of edges) {
    score *= STRENGTH_WEIGHT[edge.strengthBand] * CONFIDENCE_WEIGHT[edge.confidenceBand];
    edge.evidenceIds.forEach((id) => evidenceIds.add(id));
  }
  score *= hopDecay ** Math.max(0, edges.length - 1);
  score = Math.max(0, Math.min(1, score));

  if (evidenceIds.size === 1 && edges.length > 1) {
    warnings.push('Every hop depends on the same evidence record.');
  }
  if (edges.some((edge) => edge.confidenceBand === 'limited')) {
    warnings.push('At least one hop has limited evidence confidence.');
  }
  if (event.isFixture) warnings.push('Demonstration fixture — not a real-world event.');

  return {
    score,
    relevance: relevanceBand(score),
    warnings,
    explanation,
  };
}

export function findImpactPaths(
  snapshot: GraphSnapshot,
  event: CommodityImpactEvent,
  targetEntityId?: string,
  options: ImpactPathOptions = {},
): ImpactPath[] {
  const maxHops = options.maxHops ?? 3;
  const now = Date.parse(options.now ?? new Date().toISOString());
  const edges = snapshot.edges.filter((edge) => edgeIsCurrent(edge, now));
  const bySource = new Map<string, PublishedImpactEdge[]>();
  for (const edge of edges) {
    const list = bySource.get(edge.sourceEntityId) ?? [];
    list.push(edge);
    bySource.set(edge.sourceEntityId, list);
  }

  const paths: ImpactPath[] = [];
  const visit = (entityIds: string[], edgePath: PublishedImpactEdge[]): void => {
    const current = entityIds[entityIds.length - 1];
    if (!current) return;
    if (
      edgePath.length > 0
      && (!targetEntityId || current === targetEntityId)
    ) {
      const scored = scoreImpactPath(event, edgePath, options);
      paths.push({
        id: `${event.id}:${edgePath.map((edge) => edge.id).join('>')}`,
        eventId: event.id,
        entityIds: [...entityIds],
        edgeIds: edgePath.map((edge) => edge.id),
        ...scored,
      });
    }
    if (edgePath.length >= maxHops || (targetEntityId && current === targetEntityId)) return;

    for (const edge of bySource.get(current) ?? []) {
      if (entityIds.includes(edge.targetEntityId)) continue;
      visit([...entityIds, edge.targetEntityId], [...edgePath, edge]);
    }
  };

  for (const root of event.affectedEntityIds) visit([root], []);
  return paths.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
