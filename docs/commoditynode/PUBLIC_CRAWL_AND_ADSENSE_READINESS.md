# Public crawl and AdSense readiness

CommodityNode separates search readiness from advertising activation. A page
can be indexable without being eligible to load ads.

## Automated public crawl

After `npm run build:commoditynode`, run:

```bash
npm run commoditynode:crawl
```

The gate audits every generated research `index.html` and fails on:

- missing or duplicate title, canonical, robots, or description metadata;
- indexable pages absent from the sitemap, or noindex pages present in it;
- broken same-origin links;
- missing `main`, duplicate/missing `h1`, invalid JSON-LD, or thin main copy;
- public placeholder language and common generic AI-writing phrases;
- leaked upstream personal branding;
- any advertising script or container before activation.

The crawler treats redirect shells and search/lead workflows as intentional
noindex inventory. It verifies that they remain outside the sitemap.

## Verified baseline

The July 28, 2026 production build passes the gate with:

- 27 generated HTML pages audited;
- 23 indexable pages and 23 matching sitemap URLs;
- 4 intentional noindex or redirect pages;
- zero broken internal links, invalid JSON-LD blocks, duplicate titles, duplicate
  canonicals, placeholder phrases, upstream identity leaks, or ad-code findings;
- indexable main-content depth ranging from 82 to 718 words, with stricter
  route-specific thresholds for research articles and entity pages.

The gate runs immediately after the CommodityNode production build in the
foundation workflow, so a crawl regression cannot ship unnoticed.

## Production origin audit

After deployment, run:

```bash
npm run commoditynode:production
```

This verifies the apex research origin, the canonical
`commoditynode.com/live/` product path, and the Vercel fallback against the
current Git commit. It checks
reviewed pages, the capability API, immutable source provenance, English-only
responses under a Korean `Accept-Language` header, and representative retired
URLs that must return `410` with `noindex`.

The narrower fallback command can validate the same live build directly
through its Vercel project URL:

```bash
npm run commoditynode:production:fallback
```

The fallback command is not a launch substitute. The release gate remains red
until the unmodified production command passes on the canonical apex path.

## Advertising activation remains fail-closed

Passing the public crawl does not activate advertising. Production continues
to emit no ad code until all of the following external and editorial gates are
documented:

1. Search Console ownership and sitemap submission are confirmed for the apex.
2. Index coverage is monitored after migration and no policy/duplicate-canonical
   errors remain.
3. The AdSense publisher account and site are approved.
4. A Google-certified CMP and regional consent behavior are verified where
   required.
5. Each long-form article proposed for ads receives a manual page-level review,
   is added to the explicit route allowlist, and independently declares
   `adEligible: true`.
6. Trust, directory, commodity hub, event, company, live, developer, commercial,
   search, lead, API, and source-offer surfaces remain ad-free.

This prevents an approval attempt from silently turning thin or operational
pages into advertising inventory.
