# CommodityNode Live deployment runbook

## Project boundary

CommodityNode uses a separate Vercel project from both the research site and
the upstream World Monitor deployment.

| Surface | Project | Domain | Build |
| --- | --- | --- | --- |
| Research | existing CommodityNode research project | `commoditynode.com` | Astro project build |
| Live | `commoditynode-live` | `commoditynode.com/live/` | `npm run build:commoditynode` |
| API | initially co-located with Live; split after contract freeze | `api.commoditynode.com` | Vercel functions / Sebuf |

Deploy the live surface with:

```powershell
$commitSha = git rev-parse HEAD
vercel --local-config vercel.commoditynode.json --build-env "COMMODITYNODE_BUILD_SHA=$commitSha"
```

Production promotion is intentionally separate:

```powershell
vercel --prod --local-config vercel.commoditynode.json
```

Do not run the production command until G0-G7 are green and the release owner
has approved the exact commit.

## Required build evidence

Every deployment must expose:

- `/source/`
- `/SOURCE-OFFER.md`
- `/.well-known/commoditynode-build.json`

The JSON record must contain the deployed Git commit, a source tree URL for the
same commit, the immutable upstream base SHA, and the AGPL license path.

## Domain sequence

1. Create the `commoditynode-live` project with no production alias.
2. Deploy a branch preview using `vercel.commoditynode.json`.
3. Run smoke, accessibility, source-contract, CORS, and responsive checks on
   the immutable preview URL.
4. Route `commoditynode.com/live/` to the live shell from the canonical apex
   project configuration.
5. Keep `live.commoditynode.com` only as a permanent compatibility redirect.
6. Promote the already-tested deployment; do not rebuild a different commit.
7. Verify the apex path, redirect, source offer, build record, headers, and
   rollback target.

The repeatable origin check is:

```powershell
npm run commoditynode:production
```

It fails when `commoditynode.com/live/` does not serve the live shell, when
either deployed surface does not match the checked-out commit, when a Korean
browser preference changes the English product response, or when a retired
search URL falls through to a `200` dashboard shell.

## Rollback

Keep the last verified deployment ID in the release record. If a gate regresses,
remove the alias from the new deployment and reassign it to that exact prior
deployment. A rollback does not waive the AGPL source-offer requirement.
