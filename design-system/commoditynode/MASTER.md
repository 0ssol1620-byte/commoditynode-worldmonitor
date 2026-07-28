# CommodityNode Design System

This file defines the visual and interaction contract for CommodityNode Research and CommodityNode Live. Page overrides may refine layout, but they cannot replace accessibility, evidence, typography, motion, or provenance rules.

## Product character

CommodityNode is an evidence-linked commodity research product. It should feel calm under pressure, dense without being cramped, and precise without resembling a terminal. Decoration is allowed only when it explains a relationship, location, change, or source.

Three operating principles:

1. Evidence precedes emphasis.
2. The primary visual answer is paired with a readable text or table answer.
3. Motion explains change; it does not manufacture urgency.

## Shared source

`shared/commoditynode-design-tokens.json` is the source of truth. Run `npm run commoditynode:tokens` to generate the CSS consumed by the Vite live dashboard and the Astro research surface.

Do not hand-edit:

- `src/styles/commoditynode-tokens.generated.css`
- `blog-site/src/styles/commoditynode-tokens.generated.css`

## Typography

| Role | Typeface | Use |
| --- | --- | --- |
| Interface and research | Source Sans 3 | Navigation, headings, paragraphs, labels, tables |
| Aligned data | IBM Plex Mono | Prices, timestamps, units, identifiers, short codes |

Source Sans 3 was chosen for readable long-form research, compact labels, and clear tabular numerals. IBM Plex Mono is not general UI chrome. Headings, buttons, menus, empty states, and prose remain in Source Sans 3.

Type hierarchy:

| Token | Size | Line height | Typical use |
| --- | --- | --- | --- |
| Display | `clamp(2.25rem, 5vw, 4.5rem)` | 1.02 | Research landing statement only |
| Page title | `clamp(1.75rem, 3vw, 2.75rem)` | 1.08 | Commodity Hub, Event Pulse |
| Section title | `1.375rem` | 1.2 | Major analytical region |
| Panel title | `0.875rem` | 1.25 | Dashboard panel and drawer title |
| Body | `1rem` | 1.55 | Research and explanations |
| Compact body | `0.875rem` | 1.45 | Dense panel rows |
| Metadata | `0.75rem` | 1.4 | Source, timestamp, unit, coverage |

Use sentence case. Uppercase is reserved for actual abbreviations and short instrument codes.

## Color and state

The default live surface is dark. Research supports light and dark modes. Both themes come from the shared token source.

- Teal is the product signal, selection, and focus color.
- Ochre means attention or watch; it is not decoration.
- Muted red means adverse or unavailable.
- Blue is reserved for informational or linked-source context.
- Positive and negative market values must include signs, labels, or shapes. Color is never the only carrier.

Surfaces are flat. Use solid fills and a hairline border. Do not use glass blur, atmospheric gradients, tinted glow, colored shadows, or translucent cards as the default depth system.

## Spacing and shape

Use the 4px base scale from the shared token file. Relationships determine spacing:

- 4–8px inside a compact data group
- 12–16px between related groups
- 24–32px between analytical sections
- 48–64px between research page chapters

Radii are intentionally small:

- Controls: 3px
- Surfaces: 4px
- Overlays: 6px

Nested corners use a smaller radius than their parent. A border and its radius belong to the same element.

## Information architecture

### Research

1. Current material event or research question
2. What changed, with date and source
3. Affected commodity, geography, physical asset, route, company, and industry
4. Evidence and invalidation conditions
5. Related live map or Impact Universe view
6. Methodology, author, reviewer, corrections, and disclosure

### Live

1. Commodity impact map
2. Event Pulse
3. Benchmark and proxy tape
4. Physical supply chain
5. Route and chokepoint risk
6. Market implications
7. Saved monitors

Do not expose upstream account, Pro, community, or unrelated geopolitical product navigation in the CommodityNode variant.

## Data visualizations

Every visualization includes:

- A descriptive title that states the analytical question
- `asOf`, source, coverage, freshness, and unavailable state
- Visible units and scale
- Keyboard-accessible selection
- A table or structured list with equivalent information
- A non-color indicator for status or category
- A reduced-motion behavior

Impact Universe limits the initial view to a decision-bearing subgraph. Use clustering and progressive expansion above 100 visible nodes. Canvas or WebGL is appropriate above 100 nodes; more than 500 visible nodes requires aggregation before rendering.

The graph is not a decorative solar system. Commodity, facility, route, company, industry, event, and evidence nodes have distinct shapes and explicit labels. Every edge opens evidence, confidence, validity, and invalidation details.

## Icons

Use a single outline SVG family with a 1.75px stroke. Standard sizes are 16, 20, and 24px. Map symbols may use filled geometric marks when shape encodes a layer.

Do not use emoji for navigation, commodity types, facility types, status, weather, markets, or alerts. Copyright symbols in attribution and user-authored content are not icons.

## Motion

| Interaction | Duration | Easing |
| --- | --- | --- |
| Press feedback | 120ms | strong ease-out |
| Hover or focus color | 120–180ms | ease |
| Tooltip or popover | 150–180ms | strong ease-out |
| Drawer or modal | 180–240ms | strong ease-out |
| Map or graph focus change | 180–240ms | ease-in-out |

Frequent keyboard actions are immediate. Hover never scales or lifts a card. Buttons may use `scale(0.98)` while actively pressed if it does not alter layout. Transition only explicit properties; never use `transition: all`.

Event ripples are bounded, stop after communicating the event, and do not loop indefinitely. Reduced motion removes positional movement and freezes auto-rotation while preserving concise opacity feedback.

## Interaction

- Minimum target: 44×44 CSS pixels
- Focus: 2px signal outline with 2px offset
- Hover rules only apply under `(hover: hover) and (pointer: fine)`
- Loading feedback begins for operations expected to exceed 300ms
- Buttons become disabled while submitting
- Escape closes overlays and returns focus to the trigger
- Deep links preserve the selected commodity, event, map object, graph object, and time range

## Responsive behavior

Verify at 375, 768, 1024, and 1440px and in phone landscape.

- Mobile defaults to fewer layers and a flat map.
- Selection details use a bottom sheet with safe-area padding.
- The graph becomes a ranked path list on narrow screens; users may opt into the visual graph.
- No horizontal page scrolling.
- Tables may scroll inside a labelled region and keep the first column or header visible when useful.

## Copy

Use concrete nouns, dates, units, and consequences. Avoid AI marketing phrases, rhetorical triads, “not just X,” “unlock,” “seamless,” “next-level,” and claims without evidence.

Preferred:

> Copper concentrate exports through the port were interrupted on 27 July. Two primary sources confirm the closure; downstream smelter exposure remains unverified.

Avoid:

> Unlock next-level intelligence and seamlessly navigate the future of commodities.

## Release checklist

- No emoji used as product or structural icons
- No upstream product identity outside explicit attribution
- No duplicate or conflicting canonical, robots, or structured-data directives
- All interactive targets at least 44×44px
- Visible keyboard focus and logical focus order
- Dark and light contrast checked independently
- Reduced motion and 200% text zoom verified
- Visualizations have table/list parity
- Every public data claim exposes source and freshness
- 375, 768, 1024, and 1440px layouts captured
- No horizontal page scroll or fixed-header occlusion
- No glass blur, decorative glow, pill spam, or `transition: all`
- Core Web Vitals and JavaScript budgets pass before production promotion
