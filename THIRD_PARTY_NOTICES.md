# Third-Party Notices

CommodityNode WorldMonitor Fork contains third-party software and uses
third-party data services.

## Software

- World Monitor platform and dashboard: license and copyright notices are
  preserved in the root `LICENSE` and upstream source files.
- Official thin clients under `cli/` and `sdk/` may carry their own MIT license
  files. Those exceptions apply only to the files identified by upstream.
- JavaScript package licenses are recorded by `package-lock.json`, the license
  files included with installed packages, and the generated
  [`docs/commoditynode/third-party-software-inventory.json`](docs/commoditynode/third-party-software-inventory.json).
  CI rejects lockfile drift until the inventory is regenerated. Entries marked
  `NOASSERTION` require manual review before a production release.

## Data and services

Software licensing does not grant rights to republish third-party data,
articles, images, logos, market quotes, or API responses. Each public dataset
must pass the registry contract in [`DATA_SOURCES.md`](DATA_SOURCES.md).

This inventory is intentionally conservative. A provider's presence in source
code does not mean that its data is enabled or cleared for CommodityNode
publication.
