import type { MapLayers } from '@/types';

type CommodityNodeFreshnessStatus =
  | 'fresh'
  | 'stale'
  | 'very_stale'
  | 'error'
  | 'no_data'
  | 'disabled';

export type CommodityNodeMapHealthState =
  | 'current'
  | 'reviewed'
  | 'historical'
  | 'partial'
  | 'stale'
  | 'unavailable';

export interface CommodityNodeMapSourceState {
  name: string;
  status: CommodityNodeFreshnessStatus;
  lastUpdate: Date | null;
}

export interface CommodityNodeMapLayerHealth {
  layer: keyof MapLayers;
  state: CommodityNodeMapHealthState;
  label: string;
  detail: string;
  updatedAt: Date | null;
}

const REVIEWED_REFERENCE_LAYERS = new Set<keyof MapLayers>([
  'miningSites',
  'processingPlants',
  'commodityPorts',
  'pipelines',
  'commodityHubs',
]);

const SVG_UNSUPPORTED_LAYERS = new Set<keyof MapLayers>([
  'miningSites',
  'processingPlants',
  'commodityPorts',
  'tradeRoutes',
]);

const LABELS: Record<CommodityNodeMapHealthState, string> = {
  current: 'Current',
  reviewed: 'Reviewed reference',
  historical: 'Verified historical',
  partial: 'Partial coverage',
  stale: 'Stale source',
  unavailable: 'Status unavailable',
};

function latestUpdate(sources: readonly CommodityNodeMapSourceState[]): Date | null {
  const updates = sources
    .map((source) => source.lastUpdate?.getTime())
    .filter((value): value is number => Number.isFinite(value));
  return updates.length > 0 ? new Date(Math.max(...updates)) : null;
}

export function deriveCommodityNodeMapLayerHealth(
  layer: keyof MapLayers,
  renderer: 'webgl' | 'svg',
  sources: readonly CommodityNodeMapSourceState[] = [],
): CommodityNodeMapLayerHealth {
  if (renderer === 'svg' && SVG_UNSUPPORTED_LAYERS.has(layer)) {
    return {
      layer,
      state: 'unavailable',
      label: LABELS.unavailable,
      detail:
        'This marker layer requires the enhanced WebGL map. Other supported context layers remain available.',
      updatedAt: null,
    };
  }

  if (layer === 'commodityEvents') {
    return {
      layer,
      state: 'historical',
      label: LABELS.historical,
      detail:
        'Published historical event with three reviewed primary-source evidence records; not a live event feed.',
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
    };
  }

  if (REVIEWED_REFERENCE_LAYERS.has(layer) || sources.length === 0) {
    return {
      layer,
      state: 'reviewed',
      label: LABELS.reviewed,
      detail:
        'Curated reference geometry or registry. It does not claim live operational status.',
      updatedAt: null,
    };
  }

  const available = sources.filter(
    (source) =>
      source.status === 'fresh'
      || source.status === 'stale'
      || source.status === 'very_stale',
  );
  const unavailable = sources.filter(
    (source) =>
      source.status === 'error'
      || source.status === 'no_data'
      || source.status === 'disabled',
  );
  const updatedAt = latestUpdate(sources);

  if (available.length === 0) {
    return {
      layer,
      state: 'unavailable',
      label: LABELS.unavailable,
      detail:
        `${sources.map((source) => source.name).join(', ')} did not provide a current source state. Reference geometry may still remain visible.`,
      updatedAt,
    };
  }

  if (unavailable.length > 0) {
    return {
      layer,
      state: 'partial',
      label: LABELS.partial,
      detail:
        `${available.length} of ${sources.length} monitored sources are available. Missing sources are not inferred.`,
      updatedAt,
    };
  }

  if (
    available.some(
      (source) => source.status === 'stale' || source.status === 'very_stale',
    )
  ) {
    return {
      layer,
      state: 'stale',
      label: LABELS.stale,
      detail:
        'The latest monitored source exceeded its freshness budget. Treat current conditions as unconfirmed.',
      updatedAt,
    };
  }

  return {
    layer,
    state: 'current',
    label: LABELS.current,
    detail: 'All monitored sources are within their declared freshness budgets.',
    updatedAt,
  };
}
