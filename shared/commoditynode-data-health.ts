import type {
  CommodityNodeCadence,
  CommodityNodeDataSource,
} from './commoditynode-data-contracts';

export const COMMODITYNODE_PROVIDER_OBSERVATION_STATES = [
  'healthy',
  'degraded',
  'failed',
  'disabled',
] as const;

export type CommodityNodeProviderObservationState =
  (typeof COMMODITYNODE_PROVIDER_OBSERVATION_STATES)[number];

export type CommodityNodePublicHealthState =
  | 'current'
  | 'delayed'
  | 'unavailable'
  | 'unobserved';

export interface CommodityNodeProviderObservation {
  sourceId: string;
  checkedAt: string;
  lastSuccessAt: string | null;
  state: CommodityNodeProviderObservationState;
  latencyMs: number | null;
  detail: string;
}

export interface CommodityNodeSourceHealth {
  sourceId: string;
  sourceName: string;
  publisher: string;
  category: CommodityNodeDataSource['category'];
  cadence: CommodityNodeCadence;
  publicState: CommodityNodePublicHealthState;
  publicLabel: string;
  checkedAt: string | null;
  lastSuccessAt: string | null;
  ageMinutes: number | null;
  latencyMs: number | null;
  rightsState: CommodityNodeDataSource['rights']['status'];
  publicDisplayApproved: boolean;
  detail: string;
}

export interface CommodityNodeHealthSnapshot {
  generatedAt: string;
  state: 'operational' | 'degraded' | 'unavailable' | 'unobserved';
  sources: readonly CommodityNodeSourceHealth[];
  counts: Record<CommodityNodePublicHealthState, number>;
}

export interface CommodityNodePublicStatusBadge {
  state: CommodityNodePublicHealthState;
  label: string;
  description: string;
}

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const BUDGETS_MINUTES: Record<CommodityNodeCadence, {
  delayed: number;
  unavailable: number;
}> = {
  realtime: { delayed: 5, unavailable: 30 },
  intraday: { delayed: 30, unavailable: 240 },
  daily: { delayed: 36 * 60, unavailable: 72 * 60 },
  weekly: { delayed: 9 * 24 * 60, unavailable: 16 * 24 * 60 },
  monthly: { delayed: 40 * 24 * 60, unavailable: 70 * 24 * 60 },
  quarterly: { delayed: 120 * 24 * 60, unavailable: 200 * 24 * 60 },
  annual: { delayed: 400 * 24 * 60, unavailable: 550 * 24 * 60 },
  irregular: { delayed: 30 * 24 * 60, unavailable: 90 * 24 * 60 },
};

const PUBLIC_LABELS: Record<CommodityNodePublicHealthState, string> = {
  current: 'Current',
  delayed: 'Delayed',
  unavailable: 'Unavailable',
  unobserved: 'Status unavailable',
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[commoditynode-data-health] ${message}`);
}

function assertIsoDateTime(value: string, field: string): void {
  assert(
    ISO_DATE_TIME.test(value) && Number.isFinite(Date.parse(value)),
    `${field} must be an ISO UTC timestamp`,
  );
}

export function validateCommodityNodeProviderObservation(
  observation: CommodityNodeProviderObservation,
  sourceIds: ReadonlySet<string>,
): void {
  assert(sourceIds.has(observation.sourceId), `unknown source ${observation.sourceId}`);
  assertIsoDateTime(observation.checkedAt, `${observation.sourceId}.checkedAt`);
  if (observation.lastSuccessAt) {
    assertIsoDateTime(
      observation.lastSuccessAt,
      `${observation.sourceId}.lastSuccessAt`,
    );
    assert(
      Date.parse(observation.lastSuccessAt) <= Date.parse(observation.checkedAt),
      `${observation.sourceId}.lastSuccessAt must not follow checkedAt`,
    );
  }
  assert(
    COMMODITYNODE_PROVIDER_OBSERVATION_STATES.includes(observation.state),
    `${observation.sourceId}.state is invalid`,
  );
  assert(
    observation.latencyMs === null
      || (Number.isFinite(observation.latencyMs) && observation.latencyMs >= 0),
    `${observation.sourceId}.latencyMs must be null or a non-negative number`,
  );
  assert(
    observation.detail.trim().length > 0,
    `${observation.sourceId}.detail is required`,
  );
}

function sourceHealth(
  source: CommodityNodeDataSource,
  observation: CommodityNodeProviderObservation | undefined,
  now: string,
): CommodityNodeSourceHealth {
  if (!observation) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      publisher: source.publisher,
      category: source.category,
      cadence: source.cadence,
      publicState: 'unobserved',
      publicLabel: PUBLIC_LABELS.unobserved,
      checkedAt: null,
      lastSuccessAt: null,
      ageMinutes: null,
      latencyMs: null,
      rightsState: source.rights.status,
      publicDisplayApproved:
        source.rights.status === 'approved' && source.rights.publicDisplay,
      detail: 'No provider observation was supplied. No current-status claim is made.',
    };
  }

  const ageMinutes = observation.lastSuccessAt
    ? Math.max(0, Math.round((Date.parse(now) - Date.parse(observation.lastSuccessAt)) / 60_000))
    : null;
  const budget = BUDGETS_MINUTES[source.cadence];
  let publicState: CommodityNodePublicHealthState = 'current';

  if (
    observation.state === 'failed'
    || observation.state === 'disabled'
    || ageMinutes === null
    || ageMinutes >= budget.unavailable
  ) {
    publicState = 'unavailable';
  } else if (
    observation.state === 'degraded'
    || ageMinutes >= budget.delayed
  ) {
    publicState = 'delayed';
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    publisher: source.publisher,
    category: source.category,
    cadence: source.cadence,
    publicState,
    publicLabel: PUBLIC_LABELS[publicState],
    checkedAt: observation.checkedAt,
    lastSuccessAt: observation.lastSuccessAt,
    ageMinutes,
    latencyMs: observation.latencyMs,
    rightsState: source.rights.status,
    publicDisplayApproved:
      source.rights.status === 'approved' && source.rights.publicDisplay,
    detail: observation.detail,
  };
}

export function buildCommodityNodeHealthSnapshot(input: {
  sources: readonly CommodityNodeDataSource[];
  observations: readonly CommodityNodeProviderObservation[];
  now: string;
}): CommodityNodeHealthSnapshot {
  assertIsoDateTime(input.now, 'now');
  const sourceIds = new Set(input.sources.map((source) => source.id));
  const observations = new Map<string, CommodityNodeProviderObservation>();
  for (const observation of input.observations) {
    validateCommodityNodeProviderObservation(observation, sourceIds);
    assert(
      !observations.has(observation.sourceId),
      `duplicate observation for ${observation.sourceId}`,
    );
    observations.set(observation.sourceId, observation);
  }

  const sources = input.sources
    .map((source) => sourceHealth(source, observations.get(source.id), input.now))
    .sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  const counts: Record<CommodityNodePublicHealthState, number> = {
    current: 0,
    delayed: 0,
    unavailable: 0,
    unobserved: 0,
  };
  for (const source of sources) counts[source.publicState] += 1;

  let state: CommodityNodeHealthSnapshot['state'];
  if (counts.unavailable > 0) state = 'unavailable';
  else if (counts.delayed > 0) state = 'degraded';
  else if (counts.current === 0) state = 'unobserved';
  else if (counts.unobserved > 0) state = 'degraded';
  else state = 'operational';

  return { generatedAt: input.now, state, sources, counts };
}

export function createCommodityNodePublicStatusBadge(
  sources: readonly CommodityNodeSourceHealth[],
): CommodityNodePublicStatusBadge {
  if (sources.length === 0 || sources.every((source) => source.publicState === 'unobserved')) {
    return {
      state: 'unobserved',
      label: PUBLIC_LABELS.unobserved,
      description: 'Current source status is not available. No freshness claim is made.',
    };
  }
  if (sources.some((source) => source.publicState === 'unavailable')) {
    return {
      state: 'unavailable',
      label: PUBLIC_LABELS.unavailable,
      description: 'One or more required sources are unavailable. Missing values are not inferred.',
    };
  }
  if (
    sources.some(
      (source) =>
        source.publicState === 'delayed' || source.publicState === 'unobserved',
    )
  ) {
    return {
      state: 'delayed',
      label: PUBLIC_LABELS.delayed,
      description: 'Some source updates are delayed or not currently observed.',
    };
  }
  return {
    state: 'current',
    label: PUBLIC_LABELS.current,
    description: 'All monitored sources are within their declared update budgets.',
  };
}
