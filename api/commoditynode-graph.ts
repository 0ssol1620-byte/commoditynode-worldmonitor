// @ts-expect-error -- shared JavaScript CORS utility has no declaration file.
import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';
import {
  getCommodityNodeGraphEvidence,
  getCommodityNodeGraphSnapshot,
  getCommodityNodeImpactPaths,
  getCommodityNodeSubgraph,
  resolveCommodityNodeGraphEntity,
} from '../server/commoditynode/impact-graph-service';
import { checkRateLimit } from '../server/_shared/rate-limit';

const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
const MAX_TEXT_PARAMETER_LENGTH = 160;

function json(request: Request, value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      ...getCorsHeaders(request),
      'Cache-Control': status === 200 ? CACHE_CONTROL : 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function numberParam(url: URL, key: string): number | undefined {
  const value = url.searchParams.get(key);
  if (value === null || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export default async function handler(request: Request): Promise<Response> {
  if (isDisallowedOrigin(request)) return json(request, { error: 'origin_not_allowed' }, 403);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }
  if (request.method !== 'GET') return json(request, { error: 'method_not_allowed' }, 405);
  const rateLimited = await checkRateLimit(request, getCorsHeaders(request));
  if (rateLimited) return rateLimited;

  const url = new URL(request.url);
  for (const key of ['op', 'snapshot', 'q', 'root', 'target', 'id']) {
    if ((url.searchParams.get(key)?.length ?? 0) > MAX_TEXT_PARAMETER_LENGTH) {
      return json(request, { error: 'parameter_too_long', parameter: key }, 400);
    }
  }
  const operation = url.searchParams.get('op') ?? 'snapshot';
  const snapshotId = url.searchParams.get('snapshot') ?? undefined;

  if (operation === 'snapshot') {
    const snapshot = getCommodityNodeGraphSnapshot(snapshotId);
    return snapshot
      ? json(request, { data: snapshot })
      : json(request, { error: 'snapshot_not_found' }, 404);
  }
  if (operation === 'resolve') {
    const query = url.searchParams.get('q') ?? '';
    const resolution = resolveCommodityNodeGraphEntity(query, snapshotId);
    return json(request, { data: resolution }, resolution.status === 'unresolved' ? 404 : 200);
  }
  if (operation === 'subgraph') {
    const root = url.searchParams.get('root') ?? '';
    const subgraph = getCommodityNodeSubgraph({
      root,
      snapshotId,
      maxHops: numberParam(url, 'maxHops'),
      maxNodes: numberParam(url, 'maxNodes'),
      maxEdges: numberParam(url, 'maxEdges'),
    });
    return subgraph
      ? json(request, { data: subgraph })
      : json(request, { error: 'root_or_snapshot_not_found' }, 404);
  }
  if (operation === 'path') {
    const target = url.searchParams.get('target') ?? '';
    const paths = getCommodityNodeImpactPaths({
      target,
      snapshotId,
      maxHops: numberParam(url, 'maxHops'),
    });
    return paths
      ? json(request, { data: paths })
      : json(request, { error: 'target_or_snapshot_not_found' }, 404);
  }
  if (operation === 'evidence') {
    const id = url.searchParams.get('id') ?? '';
    const result = getCommodityNodeGraphEvidence(id, snapshotId);
    return result
      ? json(request, { data: result })
      : json(request, { error: 'graph_object_not_found' }, 404);
  }
  return json(request, { error: 'unsupported_operation' }, 400);
}
