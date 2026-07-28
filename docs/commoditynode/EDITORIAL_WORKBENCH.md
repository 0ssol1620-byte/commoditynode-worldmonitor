# CommodityNode editorial workbench

The editorial workbench is a private, loopback-only review surface for event facts,
claim-to-evidence links, resolved entities, impact-path candidates, rights issues, and
named decisions. It is intentionally excluded from every public build and deployment
artifact.

## Run it

```bash
npm run commoditynode:editorial:dev
```

Open `http://127.0.0.1:4178`. The server binds only to `127.0.0.1`; it does not listen
on a LAN interface. To use a different local port:

```bash
COMMODITYNODE_EDITORIAL_PORT=4180 npm run commoditynode:editorial:dev
```

On PowerShell:

```powershell
$env:COMMODITYNODE_EDITORIAL_PORT = '4180'
npm run commoditynode:editorial:dev
```

The build-only command is:

```bash
npm run commoditynode:editorial:build
```

It writes to `.commoditynode-private/editorial/`, which is ignored by Git and is not
copied into `public/`, `dist/`, or `blog-site/dist/`.

## Workflow

```text
machine_extracted
  -> needs_sources | needs_rights | needs_editor
  -> needs_review
  -> approved
  -> published
  -> superseded | corrected | retracted
```

The allowed transition set lives in
`shared/commoditynode-editorial-workflow.ts`. A reviewer cannot skip from
`machine_extracted` to `approved`, and approval fails closed when any machine-checkable
publication condition remains open.

Review actions create immutable, SHA-addressed JSON audit records under
`.commoditynode-private/editorial/decisions/`. The workbench replays valid decisions on
restart. An approval decision still does not edit or publish Astro content; publication
is a separate controlled operation.

## Publication checks

A material or critical event requires all of the following:

- an exact event date and reviewed geographic location;
- at least one resolved entity;
- claims linked to known evidence records;
- exact source locators and HTTPS source URLs;
- authoritative primary evidence or source diversity;
- stated unknowns;
- no unresolved rights issue;
- a named reviewer and review timestamp before final publication.

Fixtures remain visible inside the private queue so the negative path can be tested, but
the gate never permits fixture approval or public publication.

## Source catalog

`shared/commoditynode-source-catalog.ts` is an allowlist rather than a general crawler
seed list. It currently covers:

- EIA Today in Energy and EIA press-release RSS for crude oil;
- USGS National Minerals Information Center publications for copper and gold;
- USDA FAS cocoa analysis and GAIN reports;
- a held USDA NASS feed for future U.S. agricultural presets;
- SEC EDGAR company submissions for reviewed commodity-company CIKs.

Every source entry declares authority class, transport, preset scope, collection
interval, retention limit, rights review, and module-level failure behavior. The catalog
does not authorize full-text redistribution.

## Security boundary

The local server applies:

- loopback-address and Host checks;
- per-process CSRF tokens;
- same-origin review writes;
- 32 KiB request limits;
- restrictive CSP, frame denial, no-referrer, and Permissions Policy headers;
- `noindex, nofollow, noarchive, nosnippet` in both HTTP headers and HTML metadata;
- no third-party scripts, fonts, analytics, ads, or remote assets.

A future `editorial.commoditynode.com` deployment must use real identity authentication,
role-based authorization, durable database audit records, and Vercel deployment
protection. The local server must not be exposed through a tunnel or reverse proxy as a
substitute for those controls.
