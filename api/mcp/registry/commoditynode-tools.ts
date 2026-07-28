import { CANONICAL_COMMODITYNODE_ALERT_EVENTS } from '../../../convex/config/commodityNodeAlertCatalog';
import {
  COMMODITY_GROUP_LABELS,
  COMMODITY_UNIVERSE_EDGES,
  COMMODITY_UNIVERSE_NODES,
} from '../../../src/config/commoditynode-universe';
import { TRADE_ROUTES } from '../../../src/config/trade-routes';
import {
  getCommodityNodeGraphEvidence,
  getCommodityNodeGraphSnapshot,
} from '../../../server/commoditynode/impact-graph-service';
import type { ToolDef } from '../types';

function textArg(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max).toLowerCase() : '';
}

export const COMMODITYNODE_TOOLS: ToolDef[] = [
  {
    name: 'commoditynode_list_events',
    _outputBudgetBytes: 32768,
    description:
      'List release-reviewed CommodityNode Event Pulse records. Every result links to crawlable evidence and excludes drafts and fixtures.',
    inputSchema: {
      type: 'object',
      properties: {
        materiality: {
          type: 'string',
          enum: ['notable', 'material', 'critical'],
          description: 'Optional exact materiality filter.',
        },
      },
      required: [],
    },
    outputSchema: {
      type: 'object',
      required: ['events', 'total'],
      properties: {
        events: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        publicationPolicy: { type: 'string' },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _execute: async (params) => {
      const materiality = textArg(params.materiality);
      const events = CANONICAL_COMMODITYNODE_ALERT_EVENTS
        .filter((event) => !materiality || event.materiality === materiality)
        .map(({ scopes: _scopes, ...event }) => event);
      return {
        events,
        total: events.length,
        publicationPolicy: 'published_evidence_only',
      };
    },
    _apiPaths: [],
  },
  {
    name: 'commoditynode_list_benchmarks',
    _outputBudgetBytes: 65536,
    description:
      'List CommodityNode commodity benchmarks and named analytical relationships. Instruments label futures benchmarks and ETF proxies explicitly.',
    inputSchema: {
      type: 'object',
      properties: {
        group: {
          type: 'string',
          enum: ['energy', 'industrial-metals', 'precious-metals', 'agriculture'],
          description: 'Optional exact commodity group.',
        },
        commodity_id: {
          type: 'string',
          description: 'Optional canonical commodity ID such as copper or gold.',
        },
      },
      required: [],
    },
    outputSchema: {
      type: 'object',
      required: ['benchmarks', 'relationships', 'total'],
      properties: {
        benchmarks: { type: 'array', items: { type: 'object' } },
        relationships: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _execute: async (params) => {
      const group = textArg(params.group);
      const commodityId = textArg(params.commodity_id);
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
    },
    _apiPaths: [],
  },
  {
    name: 'commoditynode_list_routes',
    _outputBudgetBytes: 65536,
    description:
      'List reviewed CommodityNode trade-route reference corridors. Status is registry metadata, not live vessel telemetry.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['container', 'energy', 'bulk'],
          description: 'Optional exact route category.',
        },
        status: {
          type: 'string',
          enum: ['active', 'disrupted', 'high_risk'],
          description: 'Optional exact reviewed status.',
        },
      },
      required: [],
    },
    outputSchema: {
      type: 'object',
      required: ['routes', 'total', 'telemetryStatus'],
      properties: {
        routes: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        telemetryStatus: { type: 'string' },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _execute: async (params) => {
      const category = textArg(params.category);
      const status = textArg(params.status);
      const routes = TRADE_ROUTES.filter(
        (route) => (!category || route.category === category) && (!status || route.status === status),
      );
      return { routes, total: routes.length, telemetryStatus: 'reference_registry' };
    },
    _apiPaths: [],
  },
  {
    name: 'commoditynode_get_evidence',
    _outputBudgetBytes: 131072,
    description:
      'Resolve one CommodityNode graph entity, relationship, or evidence record from the published reviewed graph snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        object_id: {
          type: 'string',
          description: 'Canonical entity, edge, or evidence ID.',
        },
        snapshot_id: {
          type: 'string',
          description: 'Optional graph snapshot ID. Omit for the current published snapshot.',
        },
      },
      required: ['object_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        snapshot: { type: ['object', 'null'] },
        result: { type: ['object', 'null'] },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _execute: async (params) => {
      const objectId = textArg(params.object_id, 160);
      const snapshotId = textArg(params.snapshot_id, 160) || undefined;
      const snapshot = getCommodityNodeGraphSnapshot(snapshotId);
      const result = objectId
        ? getCommodityNodeGraphEvidence(objectId, snapshotId)
        : null;
      return {
        found: Boolean(result),
        snapshot: snapshot
          ? {
              id: snapshot.id,
              ontologyVersion: snapshot.ontologyVersion,
              createdAt: snapshot.createdAt,
            }
          : null,
        result,
      };
    },
    _apiPaths: [],
  },
];
