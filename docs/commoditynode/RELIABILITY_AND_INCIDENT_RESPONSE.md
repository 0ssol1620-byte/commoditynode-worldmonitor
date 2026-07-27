# CommodityNode reliability and incident response

CommodityNode fails soft at the dataset, claim, graph edge, image, and module
level. An unavailable dependency must not be translated into a healthy badge,
a zero value, a carried-forward quote, or a newly generated claim.

The public research build is the durable fallback. It retains its original
source and observation timestamps and does not claim to be live during an
incident.

## Deterministic outage simulations

Run:

```text
npm run commoditynode:resilience
```

The simulation covers provider, Redis, PostgreSQL, image-pipeline, and AI
failures. Each scenario must degrade at least one dependent surface, preserve
the static research surface, and keep these invariants:

- missing values remain missing;
- AI has no publication authority;
- broken media is replaced by accessible evidence text;
- operator diagnostics remain private;
- database mutations fail closed.

## Severity model

| Severity | Example | Public effect | Response target |
| --- | --- | --- | --- |
| SEV-1 | Wrong published claim, leaked secret, rights violation | Remove or block the affected unit immediately | Begin containment as soon as an owner sees the report |
| SEV-2 | Live map or core evidence path unavailable | Static research remains; affected module is marked unavailable | Diagnose and publish an internal incident record |
| SEV-3 | One provider delayed or one image derivative missing | Local degraded state | Repair in normal operations |
| SEV-4 | Cosmetic or non-blocking editorial defect | No evidence-contract failure | Backlog and review |

CommodityNode does not promise continuous staffed monitoring. Response targets
describe the procedure after an owner receives a report, not a 24/7 SLA.

## Incident runbook

1. Record UTC start time, reporter, affected routes, commit, deployment ID, and
   the first observed symptom.
2. Classify whether the incident concerns data correctness, availability,
   security, privacy, rights, or presentation.
3. Contain the smallest affected unit. Disable a dataset, claim, edge, image,
   or route rather than the entire product when safe.
4. Preserve evidence: provider response metadata, content hash, build record,
   screenshots, logs, and the last known verified timestamp. Never copy
   credentials into the incident record.
5. Select the response:
   - stale/unavailable provider: show the declared unavailable state;
   - Redis failure: suppress cache-derived freshness claims;
   - database failure: stop mutations and use only an explicitly verified
     read-only snapshot;
   - image failure: remove the broken media element and retain caption/alt
     evidence;
   - AI failure: continue deterministic and human workflows;
   - security or privacy incident: stop the affected processing path and use
     the private security channel.
6. Verify the repair using the same route, dependency, and failure condition
   that produced the incident.
7. Record recovery time, evidence, residual risk, and whether a correction or
   takedown is required.

## Data correction runbook

1. Freeze the affected publication record and retain its previous content hash.
2. Identify the exact claim, unit, instrument type, source locator, and
   observation timestamp.
3. Re-evaluate corroboration and rights records.
4. Publish the smallest factual correction with editor, review time, reason,
   superseded record, and source links.
5. Update dependent graph edges and pages; do not silently overwrite the
   correction history.
6. Verify the corrections page, structured data, sitemap eligibility, and live
   evidence drawer.

## Rights-takedown runbook

1. Record the requester and exact asset/source locator in the private rights
   queue.
2. Immediately block public rendering when the request is plausible and the
   rights state is uncertain.
3. Preserve the internal hash and audit record without republishing the
   disputed material.
4. Review license, attribution, commercial-use, modification, and expiry
   fields.
5. Restore only after an approved rights record exists. Otherwise keep a
   text-only factual reference or remove the dependency.
6. Regenerate image sitemaps and page metadata after the disposition.

## Rollback runbook

1. Identify the last deployment that passed source-offer, contract, smoke,
   accessibility, and route checks.
2. Reassign the production alias to that immutable deployment. Do not rebuild
   from a moving branch as a rollback.
3. Verify `/source/`, `/.well-known/commoditynode-build.json`, `/api/health`,
   research canonicals, and the live shell on desktop and mobile.
4. Record the failed and restored deployment IDs.
5. Keep the faulty deployment available only to authorized reviewers until the
   post-incident review is complete.

## Post-incident record

Every SEV-1 or SEV-2 record must contain:

- impact and affected routes;
- first bad and first good timestamps;
- root cause and contributing conditions;
- why existing tests or monitoring did not stop it;
- containment and rollback evidence;
- correction, privacy, or rights actions;
- one named prevention change with an owner and verification command.
