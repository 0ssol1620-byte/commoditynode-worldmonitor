# CommodityNode Production Baseline — 2026-07-27

This snapshot separates the actual deployed CommodityNode source from the
legacy Jekyll archive referenced by earlier planning material.

## Authoritative production source

| Field | Value |
|---|---|
| Repository | `https://github.com/0ssol1620-byte/commoditynode` |
| Production branch | `main` |
| Production commit | `72dc35839b3203c43a9f4f282eaa561cd9ad6ab1` |
| Local checkout | `C:\Users\yspow\Documents\Codex\2026-07-22\new-chat\work\commoditynode` |
| Vercel project | `commoditynode` |
| Vercel project ID | `prj_X78C1Yy7ygY3nKnQAQMFTlxj8ycg` |
| Vercel team ID | `team_pUMlEXiyu9hN7t5zeTKmTRHp` |
| Verified deployment | `dpl_2EpGaHAvcE83TSSttJW2A9kmxM8z` |
| Production domains | `commoditynode.com`, `www.commoditynode.com` |

The Vercel project metadata still reports a historical `jekyll` framework
setting. The current repository is Astro and supplies its own build
configuration. That stale setting is configuration debt, not evidence that the
deployed source is the legacy Jekyll tree.

## Route inventory

The authoritative Astro source contains 23 route source files:

- home, search, and 404;
- commodity directory and dynamic commodity hub;
- event directory and dated dynamic event page;
- research directory and dynamic research page;
- entity detail;
- Impact Universe;
- scenario tool and tools directory;
- About, editorial process, methodology, sources, editorial policy,
  corrections, contact, privacy, terms, and risk disclosure.

## Content and asset inventory

| Area | Files at baseline |
|---|---:|
| `src/content` | 1 |
| `src/data` | 9 |
| `src/components` | 11 |
| `src/pages` | 23 |
| `public` | 11 |
| Source files containing chart/graph/SVG/canvas/Three terms | 18 |

The three content collections each contain one source item (`authors`,
`commodities`, and `research`). This is a thin but real editorial baseline and
must not be presented as a broad catalog.

## Public QA and publication gates

No `Publication gate`, `0-of-6`, or public compliance-portal route is present
in the authoritative 23-route Astro inventory. Such operational controls must
remain private if reintroduced. Public navigation may expose methodology,
sources, corrections, policies, status, and source code, but not internal
release checklists or synthetic readiness scores.

## Two-surface disposition

- `commoditynode.com`: retain the Astro research/editorial product as the
  canonical indexable surface.
- `live.commoditynode.com`: deploy the additive `commoditynode` Vite variant
  from this fork.
- Both surfaces consume the shared CommodityNode identity contract and link to
  the exact deployed source.
- The legacy Jekyll archive remains non-authoritative and must not be deployed
  over either surface.
