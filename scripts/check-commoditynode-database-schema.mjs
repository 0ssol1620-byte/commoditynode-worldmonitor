import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
  '../database/commoditynode/migrations/0001_commoditynode_core.sql',
  import.meta.url,
);
const sql = await readFile(migrationUrl, 'utf8');

const requiredTables = [
  'data_sources',
  'rights_records',
  'instruments',
  'observations',
  'entities',
  'entity_aliases',
  'assets',
  'events',
  'claims',
  'source_records',
  'ontology_edges',
  'graph_snapshots',
  'editorial_reviews',
  'media_assets',
  'corrections',
  'publication_records',
];

const failures = [];
for (const table of requiredTables) {
  if (!new RegExp(`CREATE TABLE commoditynode\\.${table}\\s*\\(`, 'i').test(sql)) {
    failures.push(`missing table: ${table}`);
  }
}

const requiredContracts = [
  ['transaction boundary', /\bBEGIN;[\s\S]*\bCOMMIT;/i],
  ['public access revoke', /REVOKE ALL ON ALL TABLES IN SCHEMA commoditynode FROM PUBLIC;/i],
  ['append-only review revoke', /REVOKE UPDATE, DELETE ON commoditynode\.editorial_reviews FROM PUBLIC;/i],
  ['fixture-safe published view', /event\.status = 'published'[\s\S]*event\.is_fixture = false/i],
  ['rights expiry constraint', /expires_at IS NULL OR expires_at > reviewed_at/i],
  ['exact source locator', /exact_locator text NOT NULL/i],
  ['freshness timestamps', /as_of timestamptz[\s\S]*fetched_at timestamptz[\s\S]*stale_at timestamptz[\s\S]*expires_at timestamptz/i],
  ['observation content hash', /content_hash text NOT NULL CHECK \(content_hash ~ '\^\[a-f0-9\]\{64\}\$'\)/i],
  ['published record review gate', /state <> 'published'[\s\S]*reviewed_by IS NOT NULL[\s\S]*jsonb_array_length\(blockers\) = 0/i],
];

for (const [label, pattern] of requiredContracts) {
  if (!pattern.test(sql)) failures.push(`missing contract: ${label}`);
}

if (failures.length > 0) {
  console.error('[commoditynode-database] contract failed');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'pass',
  migration: migrationUrl.pathname,
  requiredTables: requiredTables.length,
  contracts: requiredContracts.length,
}, null, 2));
