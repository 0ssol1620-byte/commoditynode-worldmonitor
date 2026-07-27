# CommodityNode security and accessibility audit

Audit date: 2026-07-28
Release branch: `feature/commoditynode-foundation`

This review covers the CommodityNode research site, live application, public
map embed, source-offer route, graph API, provider adapters, and the shared
World Monitor controls inherited by the fork.

## Security boundaries

### External fetches

- RSS fetches use an explicit domain registry, reject private and link-local
  addresses, re-check every redirect, cap redirects, and require API-key and
  rate-limit gates before fetching.
- CommodityNode provider adapters accept only six exact HTTPS hosts. Userinfo,
  non-standard ports, lookalike hosts, plaintext HTTP, and loopback addresses
  fail before the request.
- Provider redirects are handled manually and re-validated at every hop.
  Requests are GET-only, time out after 15 seconds, and reject responses above
  5 MiB.
- Notification webhooks resolve and pin public addresses before delivery,
  reject mixed private/public DNS answers, and repeat the check when sending.

### Browser and API controls

- The app shell carries HSTS, `nosniff`, a restrictive permissions policy,
  report-only COOP/COEP, `X-Frame-Options: SAMEORIGIN`, and a CSP with
  `object-src 'none'` and `base-uri 'self'`.
- Cross-origin previews use `/embed`, a separate CSP boundary with no inline
  script permission. The main dashboard is not made frameable.
- CommodityNode CORS accepts only the apex, `www`, `live`, `api`, and
  `editorial` HTTPS origins. Suffix-confusion and arbitrary subdomains fail.
- The graph endpoint is GET-only, passes through the global per-IP limiter,
  bounds text parameters to 160 characters, caps graph traversal in the
  service layer, and returns defensive content headers.
- Vite-prefixed secret names and plaintext Vercel environment dumps are
  release-blocking. Provider error text redacts query-string credentials and
  token-shaped values.
- HTML interpolation escapes by default. Raw fragments require an explicit
  audit reason, unsafe URL protocols are rejected, and widget HTML is
  sanitized before storage or display.

### Dependency audit

All six production lockfiles were checked against the live npm advisory feed.
No unbaselined high or critical advisory was found. The remaining high
advisories are documented reachability exceptions in the audit baseline:

- root: `sharp`, `brace-expansion`;
- scripts: `brace-expansion`;
- research build: `sharp`;
- Pro build: `shell-quote`.

Stale Clerk and PostCSS exceptions were removed from the baseline during this
review. The baseline gate rejects new high or critical findings and reports an
exception when an entry no longer matches the live audit.

## Accessibility coverage

Automated WCAG 2.0 A/AA, 2.1 AA, and 2.2 AA checks run with axe in Chromium
against:

- all 22 indexable or intentionally public CommodityNode research routes;
- the live application after dismissing the mission overlay;
- the immutable source-offer page;
- the CommodityNode public map embed.

The automated pass found zero violations. The broader interaction suite also
verifies:

- visible skip navigation and a single main landmark;
- real buttons with pressed state for panel, layer, preset, and graph controls;
- roving keyboard navigation and focus restoration in settings;
- Escape-to-close, focus wrapping, and 44 px touch targets in the mobile map
  drawer;
- bounded event animation and reduced-motion handling;
- an accessible Impact Universe table with a caption and the same filtered
  entities exposed by the graph view;
- screen-reader labels for graph evidence, timeline controls, source links,
  freshness states, and unavailable-state disclosures;
- contrast through computed axe checks against the rendered local fonts and
  production styles.

Automated checks do not replace assistive-technology usability sessions. A
release owner should repeat keyboard-only and current NVDA/VoiceOver smoke
checks after a major navigation, chart, map, or typography change.

## Repeatable gates

```text
npm run commoditynode:security
npm run test:e2e:commoditynode:a11y
npm run typecheck:all
npm run build:commoditynode
```

The security gate currently covers 386 assertions, with one Windows-only
symlink test skipped when Developer Mode privileges are unavailable. The same
test runs normally in Linux CI.
