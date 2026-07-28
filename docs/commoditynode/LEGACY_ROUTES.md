# CommodityNode legacy-route manifest

Legacy URLs are handled by equivalence, not by traffic preservation. A permanent
redirect is allowed only when a reviewed CommodityNode page answers the same user
intent with substantive content. Every other retired report, tool, or unshipped SaaS
surface returns `410 Gone`.

## Permanent successors

| Legacy route | Successor | Basis |
| --- | --- | --- |
| `/reports/from-chokepoint-event-to-market-impact` | `/posts/from-chokepoint-event-to-market-impact/` | Direct reviewed research successor |
| `/reports/cobre-panama-production-halt` | `/events/cobre-panama-production-halt/` | Direct evidence-backed event successor |

## Gone route families

- `/reports/*` other than the explicit redirects above
- `/intelligence-lab/*`
- `/simulator/*` and `/stress-test/*`
- `/pricing/*`, `/enterprise/*`, and `/pro/*`
- `/signals/*`, `/calendar/*`, and `/disruptions/*`
- `/tags/*`
- `/tools/*`

The `410` response is noindex/nofollow, cacheable for a short period, frame-denied, and
contains no advertising or analytics. It links only to the commodity directory and
published event directory as optional navigation; it does not pretend those pages are
equivalent replacements.

The CommodityNode host also has a final document-route safety net before the
shared World Monitor dashboard fallback. If a generated research file does not
exist, the request reaches the same `410` handler instead of returning the live
SPA shell with HTTP `200`. This covers retired top-level articles and obsolete
dynamic entity URLs that predate this manifest, including old commodity and
company slugs. API, discovery, documentation, and static-asset namespaces are
excluded from that safety net.

The executable single source of truth is
`shared/commoditynode-legacy-routes.ts`. `vercel.json` mirrors that manifest with
CommodityNode-host-only redirects and rewrites. World Monitor routes remain untouched.
