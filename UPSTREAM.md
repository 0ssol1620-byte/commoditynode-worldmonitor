# Upstream Baseline and Sync Policy

## Frozen baseline

| Field | Value |
|---|---|
| Upstream | `koala73/worldmonitor` |
| Upstream URL | `https://github.com/koala73/worldmonitor` |
| Base branch | `main` |
| Base commit | `eb51542990b244fdde1314d6682f813c9e29ff70` |
| Base commit date | `2026-07-27T12:22:10Z` |
| Baseline recorded | `2026-07-27` |
| Fork | `0ssol1620-byte/commoditynode-worldmonitor` |

The `upstream` Git remote points to the upstream repository. The fork's
`commodity` variant remains unchanged as a comparison and merge baseline;
CommodityNode is implemented as the additive `commoditynode` variant.

## Sync procedure

1. Fetch `upstream/main` and its tags.
2. Create or refresh an `upstream-main` mirror branch.
3. Compare the incoming range with `docs/fork/patch-ledger.yml`.
4. Run all upstream variant tests before CommodityNode-specific tests.
5. Open a pull request with the upstream range, red-zone conflicts, dependency
   changes, data-provider changes, and test results.
6. Never merge an upstream sync merely because it is conflict-free.

No force-push is permitted to the fork's product branches. The mirror branch
may be force-updated only with `--force-with-lease` and only after confirming
its exact target.
