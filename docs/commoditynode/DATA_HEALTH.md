# CommodityNode data health

CommodityNode keeps provider diagnostics private and gives readers only concise,
non-sensitive source-state badges. Transport success, data age, and public-display
rights are separate controls; one cannot stand in for another.

## Run the private dashboard

```bash
npm run commoditynode:health:dev
```

Open `http://127.0.0.1:4179`. The server binds only to loopback and applies
`noindex`, frame-denial, no-store, and restrictive content-security headers. Build the
files without starting a server with:

```bash
npm run commoditynode:health:build
```

Generated files stay under `.commoditynode-private/health/`, which is ignored by Git
and excluded from public builds.

## Observation input

Set `COMMODITYNODE_HEALTH_INPUT` to an absolute JSON file path. The file is an array of
provider observations:

```json
[
  {
    "sourceId": "eia",
    "checkedAt": "2026-07-28T06:00:00Z",
    "lastSuccessAt": "2026-07-28T05:58:00Z",
    "state": "healthy",
    "latencyMs": 184,
    "detail": "Latest approved series request completed."
  }
]
```

Supported states are `healthy`, `degraded`, `failed`, and `disabled`. Unknown sources,
duplicate observations, malformed timestamps, a future `lastSuccessAt`, and invalid
latency values fail the build. If no observation is supplied, the source remains
`unobserved`; the dashboard never invents a healthy state.

## Public badge contract

Public modules receive only one of four labels:

- `Current`: every selected monitored source is within its cadence budget.
- `Delayed`: a source is late, degraded, or not currently observed.
- `Unavailable`: a required source failed, is disabled, or exceeded its expiry budget.
- `Status unavailable`: no selected source has a current observation.

The public badge omits provider error text, latency, internal endpoints, and operator
details. Missing values are not inferred. Public display also remains separately
blocked unless the rights ledger approves that source.
