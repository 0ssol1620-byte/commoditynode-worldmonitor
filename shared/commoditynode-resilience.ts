export const COMMODITYNODE_DEPENDENCIES = [
  'provider',
  'redis',
  'database',
  'image-pipeline',
  'ai',
] as const;

export type CommodityNodeDependency = (typeof COMMODITYNODE_DEPENDENCIES)[number];
export type CommodityNodeSurfaceState = 'current' | 'degraded' | 'unavailable';

export interface CommodityNodeSurfaceResilience {
  id: 'research' | 'market-data' | 'event-pulse' | 'impact-universe' | 'editorial' | 'media';
  state: CommodityNodeSurfaceState;
  response: string;
}

export interface CommodityNodeOutageSimulation {
  scenario: string;
  failedDependencies: readonly CommodityNodeDependency[];
  overallState: 'operational' | 'degraded';
  surfaces: readonly CommodityNodeSurfaceResilience[];
  invariants: {
    staticResearchRemainsAvailable: true;
    missingValuesRemainMissing: true;
    aiHasNoPublicationAuthority: true;
    brokenMediaIsNotRendered: true;
    operatorDetailRemainsPrivate: true;
  };
}

const SURFACE_ORDER: CommodityNodeSurfaceResilience['id'][] = [
  'research',
  'market-data',
  'event-pulse',
  'impact-universe',
  'editorial',
  'media',
];

function surface(
  id: CommodityNodeSurfaceResilience['id'],
  state: CommodityNodeSurfaceState,
  response: string,
): CommodityNodeSurfaceResilience {
  return { id, state, response };
}

export function simulateCommodityNodeOutage(input: {
  scenario: string;
  failedDependencies: readonly CommodityNodeDependency[];
  verifiedGraphSnapshotAvailable?: boolean;
}): CommodityNodeOutageSimulation {
  const failed = new Set(input.failedDependencies);
  for (const dependency of failed) {
    if (!COMMODITYNODE_DEPENDENCIES.includes(dependency)) {
      throw new Error(`[commoditynode-resilience] unknown dependency: ${dependency}`);
    }
  }

  const surfaces = new Map<CommodityNodeSurfaceResilience['id'], CommodityNodeSurfaceResilience>([
    [
      'research',
      surface(
        'research',
        'current',
        'Serve the reviewed static research build with its original timestamps and source links.',
      ),
    ],
    [
      'market-data',
      surface(
        'market-data',
        'current',
        'Serve provider observations only inside their declared freshness budgets.',
      ),
    ],
    [
      'event-pulse',
      surface(
        'event-pulse',
        'current',
        'Serve reviewed event records and current provider observations.',
      ),
    ],
    [
      'impact-universe',
      surface(
        'impact-universe',
        'current',
        'Serve the reviewed graph snapshot and evidence drawer.',
      ),
    ],
    [
      'editorial',
      surface(
        'editorial',
        'current',
        'Accept review decisions through the append-only editorial workflow.',
      ),
    ],
    [
      'media',
      surface(
        'media',
        'current',
        'Serve the approved responsive image set with its rights metadata.',
      ),
    ],
  ]);

  if (failed.has('provider')) {
    surfaces.set(
      'market-data',
      surface(
        'market-data',
        'unavailable',
        'Show an unavailable state. Do not carry forward, interpolate, or relabel a quote.',
      ),
    );
    surfaces.set(
      'event-pulse',
      surface(
        'event-pulse',
        'degraded',
        'Keep reviewed events visible while marking provider-backed enrichment unavailable.',
      ),
    );
  }

  if (failed.has('redis')) {
    surfaces.set(
      'market-data',
      surface(
        'market-data',
        'unavailable',
        'Disable cache-dependent observations unless a provider adapter returns a newly validated value.',
      ),
    );
    surfaces.set(
      'event-pulse',
      surface(
        'event-pulse',
        'degraded',
        'Serve durable reviewed records only and suppress cache-backed freshness claims.',
      ),
    );
  }

  if (failed.has('database')) {
    surfaces.set(
      'event-pulse',
      surface(
        'event-pulse',
        'unavailable',
        'Stop durable event reads and writes; keep the static research build available.',
      ),
    );
    surfaces.set(
      'impact-universe',
      input.verifiedGraphSnapshotAvailable
        ? surface(
          'impact-universe',
          'degraded',
          'Serve the last explicitly verified graph snapshot as read-only with its snapshot timestamp.',
        )
        : surface(
          'impact-universe',
          'unavailable',
          'Show the graph as unavailable because no verified snapshot was supplied.',
        ),
    );
    surfaces.set(
      'editorial',
      surface(
        'editorial',
        'unavailable',
        'Reject review and publication mutations until durable storage is restored.',
      ),
    );
  }

  if (failed.has('image-pipeline')) {
    surfaces.set(
      'media',
      surface(
        'media',
        'degraded',
        'Render the evidence caption and accessible text fallback without a broken image element.',
      ),
    );
  }

  if (failed.has('ai')) {
    surfaces.set(
      'editorial',
      surface(
        'editorial',
        'degraded',
        'Continue deterministic extraction and human review; disable AI-assisted suggestions.',
      ),
    );
  }

  const orderedSurfaces = SURFACE_ORDER.map((id) => surfaces.get(id)!);
  const overallState = orderedSurfaces.every((item) => item.state === 'current')
    ? 'operational'
    : 'degraded';

  return {
    scenario: input.scenario,
    failedDependencies: [...failed].sort(),
    overallState,
    surfaces: orderedSurfaces,
    invariants: {
      staticResearchRemainsAvailable: true,
      missingValuesRemainMissing: true,
      aiHasNoPublicationAuthority: true,
      brokenMediaIsNotRendered: true,
      operatorDetailRemainsPrivate: true,
    },
  };
}
