# Weekly quality review

Run the private weekly review after provider health, correction, field CWV,
and privacy-reviewed content-performance exports are available:

```text
npm run commoditynode:quality:weekly -- --input <review-input.json>
```

The output is written to `.commoditynode-private/weekly-review/` as JSON and
Markdown. That directory is operational evidence, not a public dashboard.

The optional input has five bounded record sets:

- provider observations using the data-health contract;
- correction status records without report text or personal details;
- route-level LCP, INP, CLS, sample size, and collection time;
- route-level views, engaged sessions, newsletter conversions, and Pro
  conversions;
- source rights are always read from the reviewed registry in the repository.

Omitting the input is safe. The report records freshness, corrections, CWV,
and content performance as `unobserved`; it does not turn missing measurement
into zero. Rights still report from the registry, so a source held for review
keeps the weekly result in `attention`.

The report does not set growth targets or infer why traffic changed. Product
owners add targets only after the analytics, consent, and revenue contracts
are approved.
