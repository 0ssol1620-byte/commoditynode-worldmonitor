import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMODITYNODE_TOOLS } from '../api/mcp/registry/commoditynode-tools';

function tool(name: string) {
  const found = COMMODITYNODE_TOOLS.find((candidate) => candidate.name === name);
  assert.ok(found?._execute, `${name} must be executable`);
  return found;
}

async function execute(name: string, params: Record<string, unknown> = {}) {
  return tool(name)._execute!(params, 'https://commoditynode.com', {
    isPro: false,
    userId: null,
    authType: 'anonymous',
  });
}

test('CommodityNode MCP surface exposes four evidence-bounded read tools', () => {
  assert.deepEqual(
    COMMODITYNODE_TOOLS.map((entry) => entry.name),
    [
      'commoditynode_list_events',
      'commoditynode_list_benchmarks',
      'commoditynode_list_routes',
      'commoditynode_get_evidence',
    ],
  );
  for (const entry of COMMODITYNODE_TOOLS) {
    assert.equal(entry.annotations.readOnlyHint, true);
    assert.equal(entry.annotations.openWorldHint, false);
    assert.deepEqual(entry._apiPaths, []);
  }
});

test('benchmark tool labels instrument kind and filters deterministically', async () => {
  const result = await execute('commoditynode_list_benchmarks', {
    commodity_id: 'copper',
  }) as {
    benchmarks: Array<{ id: string; instrumentKind: string; x?: number }>;
    total: number;
  };
  assert.equal(result.total, 1);
  assert.equal(result.benchmarks[0]?.id, 'copper');
  assert.ok(result.benchmarks[0]?.instrumentKind);
  assert.equal('x' in (result.benchmarks[0] ?? {}), false);
});

test('event, route, and evidence tools return reviewed records without inventing live telemetry', async () => {
  const events = await execute('commoditynode_list_events') as {
    events: Array<{ evidenceHref: string }>;
    publicationPolicy: string;
  };
  assert.equal(events.publicationPolicy, 'published_evidence_only');
  assert.match(events.events[0]?.evidenceHref ?? '', /commoditynode\.com\/events\//);

  const routes = await execute('commoditynode_list_routes', { category: 'energy' }) as {
    routes: Array<{ category: string }>;
    telemetryStatus: string;
  };
  assert.ok(routes.routes.length > 0);
  assert.ok(routes.routes.every((route) => route.category === 'energy'));
  assert.equal(routes.telemetryStatus, 'reference_registry');

  const evidence = await execute('commoditynode_get_evidence', {
    object_id: 'evidence-panama-court-law-406',
  }) as { found: boolean; result: unknown };
  assert.equal(evidence.found, true);
  assert.ok(evidence.result);
});
