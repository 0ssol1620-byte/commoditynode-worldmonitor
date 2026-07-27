import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const sql = await readFile(
  new URL('../database/commoditynode/migrations/0001_commoditynode_core.sql', import.meta.url),
  'utf8',
);

describe('CommodityNode PostgreSQL migration', () => {
  it('models the complete durable data plane', () => {
    const tables = [...sql.matchAll(/CREATE TABLE commoditynode\.([a-z_]+)\s*\(/g)]
      .map((match) => match[1]);
    assert.deepEqual(tables, [
      'data_sources',
      'rights_records',
      'instruments',
      'observations',
      'entities',
      'entity_aliases',
      'assets',
      'events',
      'source_records',
      'claims',
      'claim_source_records',
      'ontology_edges',
      'edge_claims',
      'graph_snapshots',
      'editorial_reviews',
      'media_assets',
      'corrections',
      'publication_records',
    ]);
  });

  it('fails closed for public events, rights, and publication records', () => {
    assert.match(sql, /event\.is_fixture = false/);
    assert.match(sql, /status = 'approved' OR NOT public_display/);
    assert.match(sql, /jsonb_array_length\(blockers\) = 0/);
    assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA commoditynode FROM PUBLIC/);
    assert.match(sql, /REVOKE UPDATE, DELETE ON commoditynode\.editorial_reviews FROM PUBLIC/);
  });

  it('requires exact locators, freshness windows, and immutable hashes', () => {
    assert.match(sql, /exact_locator text NOT NULL/);
    assert.match(sql, /CHECK \(fetched_at >= as_of\)/);
    assert.match(sql, /CHECK \(stale_at >= fetched_at\)/);
    assert.match(sql, /CHECK \(expires_at >= stale_at\)/);
    assert.match(sql, /decision_hash text NOT NULL UNIQUE/);
    assert.match(
      sql,
      /direction <> 'conditional'[\s\S]*condition IS NOT NULL[\s\S]*length\(btrim\(condition\)\) > 0/,
    );
  });
});
