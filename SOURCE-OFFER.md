# Corresponding Source Offer

CommodityNode Live is a modified network deployment of software derived from
World Monitor. The covered source code is available at no charge under the
license in [`LICENSE`](LICENSE).

## Get the source for the deployed version

Every production build publishes:

- `/source/` — a human-readable source and attribution page;
- `/.well-known/commoditynode-build.json` — the build commit, build time,
  variant, upstream base, repository, and immutable source URLs.

The `sourceUrl` in that JSON must contain the exact `commitSha` of the deployed
build. The corresponding source can be browsed or downloaded from that
immutable Git commit.

Canonical fork:
`https://github.com/0ssol1620-byte/commoditynode-worldmonitor`

## Build and run

Requirements:

- Node.js 22
- npm with lockfile support

```sh
git clone https://github.com/0ssol1620-byte/commoditynode-worldmonitor.git
cd commoditynode-worldmonitor
git checkout <commitSha from the deployed build-info JSON>
npm ci
npm run build:commoditynode
npm run preview -- --host 127.0.0.1
```

Environment variables for optional providers are documented in `.env.example`.
Secrets are not part of Corresponding Source and must never be committed.
Without optional credentials, affected modules must display a truthful
unavailable state rather than fabricated data.

This offer is a practical access mechanism, not a replacement for the license
text. The exact legal terms are in [`LICENSE`](LICENSE).
