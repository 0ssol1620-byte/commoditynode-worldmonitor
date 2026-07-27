# CommodityNode map product contract

CommodityNode keeps the upstream map renderers but narrows their product
contract to commodity production, flows, routes, market context, and reviewed
events. The fork does not infer that a visible location is live or operating.

## Typed assets

`src/config/commoditynode-map.ts` converts reviewed registry rows into a closed
marker union:

- `mine`
- `processing_plant`
- `commodity_port`

Each adapter supplies a namespaced identifier, coordinates, commodity
coverage, an operating or reference status, and
`sourceStatus: reviewed_registry`. Rendering code can switch on `kind` without
guessing from optional fields.

Upstream geography also enters a separate private intake contract in
`src/config/commoditynode-asset-registry.ts`. Every mine, plant, and port is
assigned a namespaced candidate ID, source locator, coordinates, commodity
coverage, and an explicit `candidate`/`private` workflow state. Import is not
publication: public renderers do not consume this candidate collection, and a
record must receive rights, claim, and reviewer evidence before promotion.

## Layer navigation

The layer drawer groups CommodityNode controls into:

1. Production assets
2. Flows and routes
3. Market and event context

The same semantic grouping is emitted by both the enhanced DeckGL renderer and
the SVG fallback. When the fallback cannot render production-asset markers, it
states that limitation instead of exposing a control that appears to work.

## Commodity presets

The first four presets are deterministic:

| Preset | Initial view | Primary universe focus |
| --- | --- | --- |
| Copper | Latin America | Copper |
| Crude oil | Middle East and North Africa | WTI crude |
| Gold | Global | Gold |
| Cocoa | Africa | Cocoa |

A preset changes only CommodityNode's nine governed layer keys. It does not
silently overwrite unrelated user settings. Applying a preset updates the
visible layer controls, map view, persisted layer callback, and Impact
Universe focus in one action.

## Search and selection

CommodityNode indexes five product-specific result classes:

- commodities from the 23-node relationship taxonomy;
- mines, processing plants, and commodity ports from the facility registry;
- company headquarters plus the evidence-linked First Quantum record;
- published, verified Event Pulse records;
- reviewed reference trade routes.

Selecting a result enables its supported layer, centers the map when
coordinates exist, focuses the matching Impact Universe object, and opens the
same detail surface used by direct map clicks. Search results never fabricate a
location or a live operating state.

## Detail drawer and deep links

Every drawer record uses the closed contract in
`src/config/commoditynode-selection.ts`: entity kind, namespaced identifier,
coordinates, commodity relationship, layer, record status, source state, and
only routes that exist in the research build.

The desktop surface is a non-modal side drawer. At 720px and below it becomes
an ARIA modal bottom sheet with a backdrop, 44px controls, bounded height, and
overscroll containment. Escape and the close control restore focus to the
invoking element.

The `mapEntity` query parameter makes a selection reloadable and shareable,
for example:

```text
/?mapEntity=mine:cobre-panama
/?mapEntity=event:event-cobre-panama-halt-2023
/?mapEntity=route:gulf-europe-oil
```

Published Copper, crude-oil, Gold, and Cocoa records link to their exact
Commodity Hub routes. Other commodities link to the real research catalog
until a reviewed detail page exists. The Cobre Panama mine, event, and First
Quantum evidence record also link to the published Event Pulse. Registry
records say that they are not live telemetry; the event record says that it is
historical.

## Fallback behavior

Desktop WebGL receives the full production, processing, port, pipeline, route,
waterway, hub, and verified-event controls. Mobile and software-rendered
browsers use the SVG map. The verified historical event remains interactive
and opens the same detail sheet. Production markers and trade-route geometry
that the SVG renderer cannot draw are listed with an explicit unavailable
state; supported pipeline, waterway, hub, natural-event, and verified-event
layers remain operable.

## Verified events and source states

The event layer accepts only reviewed records whose ontology status is
`published`. The first record is the historical Cobre Panama production halt,
located from the reviewed mine registry and linked to its three primary-source
evidence records. It is labeled as historical and never presented as live
telemetry.

WebGL renders a static event core plus a two-cycle, 2.4-second ripple. The
animation settles permanently, restarts only when the layer is re-enabled, and
becomes a static ring when the operating system requests reduced motion. The
SVG fallback uses the same two-cycle limit and keyboard-operable marker.

Every governed layer exposes a source-state label. Curated geometry is marked
`Reviewed reference`; the event is `Verified historical`; monitored sources
preserve `Current`, `Partial coverage`, `Stale source`, and
`Status unavailable` as separate states. An unavailable operational source
does not remove reviewed reference geometry or imply an all-clear condition.

## Verification

Run:

```bash
npm run commoditynode:map
npm run typecheck:all
npm run test:e2e:commoditynode
```

The contract suite validates discriminants, namespaced identifiers, unique
layer grouping, preset determinism, event publication and bounded motion,
source-state separation, search-category completeness, map-ID resolution, and
route existence. Browser tests verify grouped fallback
controls, a complete Copper preset interaction, search-to-drawer selection,
deep-link restoration, focus-safe Escape close, evidence labels, and the
mobile bottom sheet.
