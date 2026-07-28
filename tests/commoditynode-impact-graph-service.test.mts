import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import handler from '../api/commoditynode-graph';
import {
  COBRE_PANAMA_GRAPH_SNAPSHOT,
  COBRE_PANAMA_IMPACT_EVENT,
} from '../shared/commoditynode-cobre-panama-impact';
import { validateGraphSnapshot } from '../shared/commodity-impact-ontology';
import {
  getCommodityNodeGraphEvidence,
  getCommodityNodeImpactPaths,
  getCommodityNodeSubgraph,
  resolveCommodityNodeGraphEntity,
} from '../server/commoditynode/impact-graph-service';

describe('CommodityNode governed impact graph', () => {
  it('publishes a valid, non-fixture Cobre Panama snapshot', () => {
    assert.equal(COBRE_PANAMA_IMPACT_EVENT.isFixture, false);
    assert.equal(COBRE_PANAMA_GRAPH_SNAPSHOT.eventId, COBRE_PANAMA_IMPACT_EVENT.id);
    assert.deepEqual(validateGraphSnapshot(COBRE_PANAMA_GRAPH_SNAPSHOT), []);
    assert.ok(
      COBRE_PANAMA_GRAPH_SNAPSHOT.edges.every(
        (edge) => edge.evidenceIds.length > 0 && edge.invalidation,
      ),
    );
  });

  it('resolves diacritics and aliases but fails closed on unknown names', () => {
    assert.equal(resolveCommodityNodeGraphEntity('Cobre Panamá').entity?.id, 'mine-cobre-panama');
    assert.equal(resolveCommodityNodeGraphEntity('FQM').status, 'ambiguous');
    assert.equal(
      resolveCommodityNodeGraphEntity('company-first-quantum').entity?.id,
      'company-first-quantum',
    );
    assert.equal(resolveCommodityNodeGraphEntity('not a real entity').status, 'unresolved');
  });

  it('enforces graph budgets and returns only referenced evidence', () => {
    const graph = getCommodityNodeSubgraph({
      root: 'Cobre Panama',
      maxHops: 99,
      maxNodes: 3,
      maxEdges: 2,
    });
    assert.ok(graph);
    assert.equal(graph.limits.maxHops, 3);
    assert.equal(graph.entities.length, 3);
    assert.equal(graph.edges.length, 2);
    assert.equal(graph.truncated, true);
    const evidenceIds = new Set(graph.edges.flatMap((edge) => edge.evidenceIds));
    assert.ok(graph.evidence.every((evidence) => evidenceIds.has(evidence.id)));
  });

  it('returns an explainable mine-to-industry path and exact edge evidence', () => {
    const paths = getCommodityNodeImpactPaths({
      target: 'Copper-consuming industries',
      maxHops: 3,
    });
    assert.equal(paths?.length, 1);
    assert.deepEqual(paths?.[0]?.entityIds, [
      'mine-cobre-panama',
      'commodity-copper',
      'industry-copper-consuming',
    ]);
    assert.equal(paths?.[0]?.warnings.length, 0);

    const evidence = getCommodityNodeGraphEvidence('edge-cobre-produces-copper');
    assert.equal(evidence?.edge?.confidenceBand, 'strong');
    assert.equal(evidence?.evidence.length, 2);
    assert.ok(evidence?.evidence.every((item) => item.locator.length > 20));
  });

  it('serves the bounded API and rejects foreign browser origins', async () => {
    const allowed = await handler(
      new Request(
        'https://commoditynode.com/api/commoditynode-graph?op=subgraph&root=Cobre%20Panama&maxHops=2',
        { headers: { origin: 'https://commoditynode.com' } },
      ),
    );
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://commoditynode.com');
    assert.match(allowed.headers.get('cache-control') ?? '', /s-maxage=3600/);

    const denied = await handler(
      new Request('https://commoditynode.com/api/commoditynode-graph', {
        headers: { origin: 'https://attacker.example' },
      }),
    );
    assert.equal(denied.status, 403);
  });
});
