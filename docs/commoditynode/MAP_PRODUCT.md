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

A preset changes only CommodityNode's eight governed layer keys. It does not
silently overwrite unrelated user settings. Applying a preset updates the
visible layer controls, map view, persisted layer callback, and Impact
Universe focus in one action.

## Fallback behavior

Desktop WebGL receives the full production, processing, port, pipeline, route,
waterway, hub, and event-context controls. Mobile and software-rendered
browsers use the SVG map. Unsupported production markers are explicitly
unavailable there; supported route and context layers and all four presets
remain operable.

## Verification

Run:

```bash
npm run commoditynode:map
npm run typecheck:all
npm run test:e2e:commoditynode
```

The contract suite validates discriminants, namespaced identifiers, unique
layer grouping, preset determinism, and enabled-layer behavior. Browser tests
verify grouped fallback controls and a complete Copper preset interaction.
