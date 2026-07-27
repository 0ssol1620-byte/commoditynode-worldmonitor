# CommodityNode Data Source and Rights Registry

## Publication rule

A source may appear in the public CommodityNode product only when all required
fields below are complete and the publication state is `approved`.

| Field | Requirement |
|---|---|
| Provider and dataset | Exact public name |
| Source URL | Stable primary locator |
| Access method | API, RSS, download, filing, or manual review |
| Terms URL | Current terms or license |
| Rights basis | Contract, open license, public domain, quotation, or link-only |
| Redistribution | Raw, transformed, excerpt-only, link-only, or prohibited |
| Attribution | Exact display requirement |
| Cadence | Collection and expected source update cadence |
| Freshness | `asOf`, `fetchedAt`, `staleAt`, and `expiresAt` policy |
| Owner | Accountable reviewer |
| Review date | Last rights and methodology review |
| Publication state | candidate, review, approved, suspended, or retired |

## Implemented registry

The typed source, rights, benchmark, claim, freshness, and publication contracts
live in:

- [`shared/commoditynode-data-contracts.ts`](shared/commoditynode-data-contracts.ts)
- [`shared/commoditynode-data-source-registry.ts`](shared/commoditynode-data-source-registry.ts)

The first reviewed records are USGS NMIC, U.S. EIA, FAOSTAT, and Yahoo Finance.
USGS and EIA U.S.-government content is recorded as public domain with explicit
third-party-media exceptions. FAOSTAT is recorded under CC BY 4.0 plus its
statistical-database terms and dataset-level exceptions. Yahoo Finance remains
`review_required`, with public display and redistribution disabled until a
licensed provider agreement is recorded.

USDA, World Bank, exchanges, filings, operator notices, RSS publishers, and
other source families remain candidates until each exact dataset receives a
registry entry. A source-family name alone never grants publication rights.

No source in `candidate` or `review` state may silently become public. Missing
or suspended sources produce a module-level `unavailable` or `partial` state;
they do not disable unrelated modules.
