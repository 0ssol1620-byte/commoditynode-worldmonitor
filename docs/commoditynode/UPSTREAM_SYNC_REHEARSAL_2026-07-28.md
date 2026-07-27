# CommodityNode upstream sync rehearsal — 2026-07-28

## Verdict

The first reviewed upstream-sync rehearsal completed without changing the
production branch. The merged tree passed CommodityNode contracts, complete
TypeScript checks, the focused upstream sitemap suite, and a full
`build:commoditynode`.

This is evidence that the current fork can absorb the inspected upstream head.
It is not a production merge approval: the immutable fork base remains pinned
until the release owner reviews and promotes a dedicated sync commit.

## Rehearsal inputs

| Field | Value |
| --- | --- |
| Fork head | `902839dd6dc899556ec7de9b6b5b01d8cdaa3e19` |
| Frozen upstream base | `eb51542990b244fdde1314d6682f813c9e29ff70` |
| Inspected upstream head | `456995b35271cdf29e6580a78f791dfcf70f51c2` |
| Ahead / behind | fork 33 / upstream 14 |
| Merge method | detached temporary worktree, `git merge --no-commit --no-ff upstream/main` |
| Production branch mutated | no |

## Conflict ledger

The merge produced two conflicts. Both were expected and resolved in the
temporary worktree.

| File | Classification | Resolution |
| --- | --- | --- |
| `package.json` | `CNWM-016`, medium-risk fork patch | Preserve CommodityNode scripts and dependencies; adopt upstream `build:sitemap`, `build:sitemap:check`, `verify:sitemaps`, and replace the retired `build:content-corpus` calls. |
| `docs/generated/stats.json` | generated artifact | Discard both hand-merged variants and rerun `npm run docs:stats` after the source merge. |

The repeatable `npm run commoditynode:upstream:rehearse` command now parses
`git merge-tree`, maps conflicts to this patch ledger, and fails closed on an
unregistered conflict.

## Regression found during the rehearsal

Upstream's new sitemap generator used `git log --format=%cs`, a commit-local
calendar date, but compared it with the current UTC date. A commit just after
midnight in Korea therefore appeared one day in the future during the UTC
afternoon.

The rehearsal resolution changed the Git format to `%cI`, converted that
timestamp to its UTC calendar date, and added a regression case for
`2026-07-28T00:15:00+09:00 → 2026-07-27`. The sitemap then regenerated and
verified with 251 canonical URLs.

This patch must accompany the reviewed upstream sync unless upstream fixes the
same boundary first.

## Verification evidence

The resolved temporary merge passed:

```text
npm run typecheck:all
npm run commoditynode:contracts
npm run build:sitemap
npm run build:sitemap:check
npx tsx --test tests/sitemap-generation.test.mjs tests/sitemap-verifier.test.mjs
npx tsx --test tests/commoditynode-variant.test.mts tests/commoditynode-built-html.test.mjs tests/deploy-config.test.mjs
npm run build:commoditynode
```

Focused test result before the full build: 185 passed, 0 failed, 1 conditional
skip. The conditional built-HTML assertion is covered by the subsequent
successful full CommodityNode build.

## Reviewed sync procedure

1. Fetch and record the exact new upstream SHA.
2. Run `npm run commoditynode:upstream:rehearse`; stop on any unclassified
   conflict.
3. Create a dedicated sync branch from the current CommodityNode branch.
4. Merge the recorded upstream SHA, never a moving ref.
5. Apply the two conflict resolutions above and the timestamp normalization
   patch when still required.
6. Regenerate product facts, documentation statistics, sitemaps, the research
   build, and build provenance.
7. Run the full foundation workflow and visual smoke tests.
8. Review the patch-ledger red zones before promotion.
9. Update the frozen base only in the reviewed sync commit and regenerate the
   source offer.
