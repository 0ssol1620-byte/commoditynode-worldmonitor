# CommodityNode governed impact graph

The Impact Universe has two distinct layers:

- a 23-instrument overview for navigating CommodityNode's tracked commodity
  benchmarks and proxies; and
- a reviewed event graph for claims that require evidence, validity dates,
  uncertainty, conditions, and explicit invalidation rules.

Node position and size in the overview do not represent market value,
liquidity, causality, or forecast confidence.

## Published reference case

`shared/commoditynode-cobre-panama-impact.ts` is the first non-fixture graph
snapshot. It models the historical November 2023 Cobre Panama production halt,
the Punta Rincón export branch, First Quantum Minerals, copper supply, and a
conditional downstream industry path.

The graph does not claim that the event alone caused a copper benchmark move.
The downstream edge remains conditional on inventories, substitution,
replacement supply, and demand. Every published edge has:

- one or more claim identifiers;
- one or more exact source records;
- reviewer and publication timestamps;
- direction, directness, strength, and confidence;
- an invalidation or supersession rule; and
- a condition whenever the direction is conditional.

The fictional Copper development fixture remains under `src/fixtures` and is
never used by the public graph service or UI.

## Read-only graph API

`GET /api/commoditynode-graph` accepts these operations:

| Operation | Required query | Result |
| --- | --- | --- |
| `snapshot` | none | Full reviewed snapshot |
| `resolve` | `q` | Fail-closed entity alias resolution |
| `subgraph` | `root` | Bounded incident subgraph |
| `path` | `target` | Directed, cycle-free event paths |
| `evidence` | `id` | Exact evidence for one edge or node |

All operations may receive a `snapshot` identifier. `subgraph` additionally
accepts `maxHops`, `maxNodes`, and `maxEdges`; the service clamps these values
to 3, 50, and 100. Unknown and ambiguous entities do not silently select a
candidate.

The endpoint is GET-only, uses the shared origin allowlist, returns no secrets,
and applies cache headers only to successful immutable review data.

## Map and universe synchronization

Clicks on mine, processing-plant, and commodity-port WebGL layers resolve their
mineral label into a tracked universe node and focus the Impact Universe.
Selecting Copper in the universe focuses the map on the reviewed Cobre Panama
case. The synchronization uses typed custom-event payloads and listeners are
removed when either component is destroyed.

## Verification

Run:

```bash
npm run commoditynode:graph
npm run typecheck:all
npm run test:e2e:commoditynode
```

The graph suite validates ontology integrity, evidence closure, aliases,
budgets, deterministic paths, CORS behavior, mobile scrolling, 44-pixel touch
targets, and the evidence drawer.
