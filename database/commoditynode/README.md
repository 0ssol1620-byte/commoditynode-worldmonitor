# CommodityNode PostgreSQL schema

`migrations/0001_commoditynode_core.sql` is the durable storage contract for
CommodityNode registry, observations, evidence, graph, rights, editorial review, media,
corrections, and publication records.

Apply migrations with a dedicated migration role. The public web and collector roles
must not own the schema.

```bash
psql "$COMMODITYNODE_DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --file database/commoditynode/migrations/0001_commoditynode_core.sql
```

The migration revokes all access from PostgreSQL `PUBLIC`. Grant only the minimum
permissions required by separately managed application roles:

- collectors: insert observations and private candidates;
- editors: read private candidates and append editorial decisions;
- publishers: create publication records and reviewed snapshots;
- public API: select only reviewed publication views and approved observations.

Do not give application roles ownership, broad schema creation privileges, or update and
delete access to `editorial_reviews`.

The repository validates the migration contract without needing production credentials:

```bash
npm run commoditynode:database
```

Provisioning a managed PostgreSQL instance, applying network restrictions, creating
roles, storing credentials in the deployment platform, and running restore drills remain
environment operations. They must be verified against the actual production project
before CNWM-037 can move from `in_progress` to `complete`.
