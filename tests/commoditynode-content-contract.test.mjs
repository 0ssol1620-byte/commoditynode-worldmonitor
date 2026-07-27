import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const contentRoot = resolve(root, 'blog-site/src/content');
const readJson = (path) => JSON.parse(readFileSync(resolve(contentRoot, path), 'utf8'));

describe('CommodityNode research content contract', () => {
  it('requires explicit benchmark semantics and evidence on every commodity hub', () => {
    const files = readdirSync(resolve(contentRoot, 'commodities')).filter((file) =>
      file.endsWith('.json'),
    );
    assert.equal(files.length, 4);

    for (const file of files) {
      const commodity = readJson(`commodities/${file}`);
      assert.match(commodity.benchmark.symbol, /\S/);
      assert.match(commodity.benchmark.unit, /\S/);
      assert.match(commodity.benchmark.provider, /\S/);
      assert.match(commodity.benchmark.delayPolicy, /\S/);
      assert.ok(
        ['futures_benchmark', 'regional_futures_benchmark', 'etf_proxy'].includes(
          commodity.benchmark.instrumentType,
        ),
      );
      assert.ok(commodity.evidence.length >= 1);
      for (const evidence of commodity.evidence) {
        assert.match(evidence.url, /^https:\/\//);
        assert.match(evidence.publisher, /\S/);
        assert.match(evidence.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('prevents the synthetic Copper event from masquerading as current intelligence', () => {
    const fixture = readJson('events/example-copper-disruption.json');
    assert.equal(fixture.isFixture, true);
    assert.notEqual(fixture.status, 'published');
    assert.match(fixture.title, /Fictional/i);
    assert.match(fixture.summary, /not an observed event/i);
  });

  it('keeps company and industry publication fail-closed unless evidence exists', () => {
    const publishableJson = (directory) =>
      readdirSync(resolve(contentRoot, directory)).filter((file) => file.endsWith('.json'));
    const companyFiles = publishableJson('companies');
    assert.deepEqual(companyFiles, ['first-quantum-minerals.json']);
    for (const file of companyFiles) {
      const company = readJson(`companies/${file}`);
      assert.equal(company.publicationState, 'published');
      assert.equal(company.isFixture, false);
      assert.equal(company.publishable, true);
      assert.ok(company.evidence.length >= 2);
      assert.ok(company.limitations.length >= 1);
      assert.ok(company.assets.length >= 1);
      for (const evidence of company.evidence) {
        assert.match(evidence.url, /^https:\/\//);
        assert.match(evidence.locator, /\S/);
      }
    }
    assert.deepEqual(publishableJson('industries'), []);
  });
});
