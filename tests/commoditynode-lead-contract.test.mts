import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  approvedCommodityIds,
  cleanCommodityNodeLeadField,
  normalizeCommodityNodeEmail,
  randomHex,
  sha256Hex,
} from '../server/commoditynode/lead-contract';

describe('CommodityNode lead capture contract', () => {
  it('normalizes email without accepting header or control injection', () => {
    assert.equal(normalizeCommodityNodeEmail(' Analyst@Example.COM '), 'analyst@example.com');
    assert.equal(normalizeCommodityNodeEmail('not-an-email'), null);
    assert.equal(cleanCommodityNodeLeadField('hello\r\nworld', 100), 'helloworld');
  });

  it('bounds and deduplicates approved commodity identifiers', () => {
    assert.deepEqual(
      approvedCommodityIds(['Copper', 'copper', 'crude-oil', '../escape', '', 5]),
      ['copper', 'crude-oil'],
    );
    assert.equal(approvedCommodityIds(Array.from({ length: 20 }, (_, index) => `c-${index}`)).length, 12);
  });

  it('creates one-time tokens and stores only a deterministic hash', async () => {
    const token = randomHex();
    assert.match(token, /^[a-f0-9]{64}$/);
    const hash = await sha256Hex(token);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(await sha256Hex(token), hash);
  });
});

