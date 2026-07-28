import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const inventory = JSON.parse(
  readFileSync(
    resolve(root, 'docs', 'commoditynode', 'third-party-software-inventory.json'),
    'utf8',
  ),
);

describe('CommodityNode third-party software inventory', () => {
  it('covers every production and supporting lockfile deterministically', () => {
    assert.deepEqual(inventory.lockfiles, [
      'package-lock.json',
      'blog-site/package-lock.json',
      'consumer-prices-core/package-lock.json',
      'pro-test/package-lock.json',
      'scripts/package-lock.json',
    ]);
    assert.match(inventory.lockfileSetSha256, /^[a-f0-9]{64}$/);
    assert.equal(inventory.packageCount, inventory.packages.length);
    assert.ok(inventory.packageCount > 2_000);
  });

  it('has a resolved license expression for every package version', () => {
    assert.equal(inventory.unresolvedLicenseCount, 0);
    assert.deepEqual(inventory.reviewRequired, []);
    for (const entry of inventory.packages) {
      assert.ok(entry.name);
      assert.ok(entry.version);
      assert.notEqual(entry.license, 'NOASSERTION');
      assert.ok(entry.installRoots.length > 0);
    }
  });

  it('contains no duplicate name/version rows', () => {
    const keys = inventory.packages.map((entry) => `${entry.name}@${entry.version}`);
    assert.equal(new Set(keys).size, keys.length);
  });

  it('records manual evidence for packages whose lock metadata omitted a license', () => {
    for (const name of [
      '@dodopayments/convex',
      '@mapbox/jsonlint-lines-primitives',
      'eyes',
      'mailcheck',
      'png-js',
      'text-encoding-utf-8',
    ]) {
      const entries = inventory.packages.filter((entry) => entry.name === name);
      assert.ok(entries.length > 0, `${name} missing from inventory`);
      assert.ok(entries.every((entry) => entry.licenseSource === 'manual_review'));
      assert.ok(entries.every((entry) => entry.licenseEvidence?.startsWith('https://')));
    }
  });
});
