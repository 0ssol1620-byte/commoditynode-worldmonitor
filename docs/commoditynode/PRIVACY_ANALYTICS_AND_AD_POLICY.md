# CommodityNode privacy, analytics, and advertising runtime

CommodityNode uses a fail-closed consent contract shared by the static research
surface and the Live application.

## Runtime rules

- Necessary storage records the versioned privacy choice and nothing else.
- Optional analytics is disabled until an explicit choice enables it.
- The CommodityNode build never loads the upstream World Monitor Umami or Vercel
  Analytics clients.
- Accepted product events contain only an allowlisted event, surface, route type,
  placement, entity type, and conversion family.
- Email, name, account or session identifiers, referrer, URL query, and free text
  are not part of the schema.
- The ingestion endpoint aggregates directly into daily Redis counters. It does
  not persist raw event rows.
- Counters expire after 400 days.
- Missing aggregate storage returns `503`; the client treats measurement as
  best-effort and product behavior does not change.

## Advertising gate

Advertising remains disabled across the public product. The ad component can
render only when all of these conditions are true:

1. the request is a CommodityNode long-form research article;
2. its slug is present in the manual route allowlist;
3. its reviewed frontmatter independently declares `adEligible: true`;
4. the publication contract passes;
5. the configured, jurisdiction-appropriate advertising consent permits script
   activation.

The current allowlist is empty. Consequently, production emits no ad containers
or advertising scripts. Enabling a future provider requires a separate reviewed
change that identifies the provider and publisher account, verifies a Google-
certified CMP where required, updates the privacy policy, and proves that
forbidden surfaces remain clean.

## Verification

```bash
npx tsx --test tests/commoditynode-privacy-analytics.test.mts
npm run build:commoditynode
node --test tests/commoditynode-research-build.test.mjs
```
