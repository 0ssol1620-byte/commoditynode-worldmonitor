import {
  COMMODITY_GROUP_LABELS,
  COMMODITY_UNIVERSE_EDGES,
  COMMODITY_UNIVERSE_NODES,
} from '../../src/config/commoditynode-universe';
import { TRADE_ROUTES } from '../../src/config/trade-routes';

export function listCommodityNodeBenchmarks(group: string, commodityId: string) {
  const benchmarks = COMMODITY_UNIVERSE_NODES
    .filter((node) => (!group || node.group === group) && (!commodityId || node.id === commodityId))
    .map(({ x: _x, y: _y, ...node }) => ({
      ...node,
      groupLabel: COMMODITY_GROUP_LABELS[node.group],
    }));
  const visibleIds = new Set(benchmarks.map((node) => node.id));
  const relationships = COMMODITY_UNIVERSE_EDGES.filter(
    (edge) => visibleIds.has(edge.source) || visibleIds.has(edge.target),
  );

  return { benchmarks, relationships, total: benchmarks.length };
}

export function listCommodityNodeRoutes(category: string, status: string) {
  const routes = TRADE_ROUTES.filter(
    (route) => (!category || route.category === category) && (!status || route.status === status),
  );

  return { routes, total: routes.length, telemetryStatus: 'reference_registry' };
}
