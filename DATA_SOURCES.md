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

## Initial registry

The following entries are implementation candidates, not blanket publication
approval.

| Provider or source family | Intended use | Initial state | Required action |
|---|---|---|---|
| USGS | Mineral and facility context | review | Confirm dataset-specific terms and attribution |
| U.S. EIA | Energy inventories and flows | review | Record API terms, units, revisions, and cadence |
| USDA | Agriculture production and inventory | review | Record series-level methodology and revisions |
| World Bank | Macro and commodity context | review | Record indicator license and transformation |
| Official exchanges/providers | Benchmark and proxy quotes | review | Verify redistribution, delay, instrument, unit |
| Company filings and releases | Event evidence | review | Store exact filing/page locator and quotation scope |
| Port/operator/regulator notices | Route and asset status | review | Store primary locator, validity window, correction path |
| Curated RSS publishers | Event discovery | candidate | Link to originals; no full-text republication |

No source in `candidate` or `review` state may silently become public. Missing
or suspended sources produce a module-level `unavailable` or `partial` state;
they do not disable unrelated modules.
