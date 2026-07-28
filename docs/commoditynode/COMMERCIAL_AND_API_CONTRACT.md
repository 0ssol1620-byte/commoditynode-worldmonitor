# CommodityNode commercial and API contract

The executable source of truth is
`shared/commoditynode-commercial-contract.ts`. It deliberately separates
available public functionality from a professional candidate that is not for
sale.

## Public access

Public research, Live, up to 100 saved entities, up to 50 alert rules, the
published three-hop graph, four read-only MCP tools, and the documented public
read scopes remain available without a paid checkout. The public API planning
envelope is 100 requests per day with a ten-request minute burst; the currently
deployed edge limiter may be stricter and remains authoritative until API keys
are enabled.

## Professional candidate

The candidate contract specifies ten years of historical replay, JSON/CSV/PNG
graph export, six-hop advanced path analysis, 10,000 API requests per day with a
120-request minute burst, and the paid scopes:

- `commodity.history.read`
- `commodity.graph.export`
- `commodity.paths.advanced`

These are product requirements, not promises of current availability. The
candidate has no published price and `saleState: not_for_sale`.

## Checkout activation

CommodityNode checkout is fail closed. It may be activated only when all six
independent gates are true:

1. Product facts and displayed limits are verified.
2. Every paid feature passes end-to-end tests.
3. Legal terms are published.
4. The production privacy runtime is verified.
5. A refund and support owner is assigned.
6. Production payment webhooks and reconciliation pass.

The existing WorldMonitor catalog, checkout button, entitlement roles, and
billing portal are not CommodityNode products and must never be exposed on a
CommodityNode hostname. A release that merely changes a price or environment
variable does not open checkout; the executable gate must return `enabled`.
