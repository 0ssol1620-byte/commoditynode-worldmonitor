# CommodityNode visual regression QA

CommodityNode keeps reviewed golden scenes for the three analytical surfaces
that carry the highest interaction and trust risk:

- the 2D analytical map, including the SVG fallback used when WebGL is
  unavailable;
- the fixed 3D globe, with the CommodityNode-only layer taxonomy and
  non-animated chokepoint markers;
- the complete 23-instrument Impact Universe and its evidence inspector.

The baselines use a fixed viewport, UTC locale, dark theme, fixed globe
texture, fixed render scale, disabled motion, a dismissed mission prompt, and
a hidden wall clock. They therefore fail on product changes rather than the
time of day or animation frame.

Run the review gate:

```bash
npm run test:e2e:commoditynode:visual
```

Update baselines only after manually reviewing all three generated PNG files:

```bash
npm run test:e2e:commoditynode:visual:update
```

The test also rejects the regressions found during the July 2026 launch audit:

- full-width SVG markers stacked against the left edge;
- color-emoji chokepoint markers that render as large white circles;
- unreviewed generic news markers in the CommodityNode globe;
- upstream author UI inside the CommodityNode product surface;
- a generic globe layer list instead of the three CommodityNode analytical
  groups.

Visual approval is not a substitute for semantic accessibility. The same
release must also pass `npm run test:e2e:commoditynode:a11y`.
