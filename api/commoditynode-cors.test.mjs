import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getCorsHeaders, isDisallowedOrigin } from './_cors.js';

function request(origin) {
  return new Request('https://api.commoditynode.com/api/bootstrap', {
    headers: { origin },
  });
}

describe('CommodityNode CORS allowlist', () => {
  for (const origin of [
    'https://commoditynode.com',
    'https://www.commoditynode.com',
    'https://live.commoditynode.com',
    'https://api.commoditynode.com',
    'https://editorial.commoditynode.com',
  ]) {
    it(`allows ${origin}`, () => {
      const req = request(origin);
      assert.equal(isDisallowedOrigin(req), false);
      assert.equal(getCorsHeaders(req)['Access-Control-Allow-Origin'], origin);
    });
  }

  it('rejects lookalike and arbitrary subdomains', () => {
    for (const origin of [
      'https://live.commoditynode.com.evil.example',
      'https://untrusted.commoditynode.com',
      'http://live.commoditynode.com',
    ]) {
      assert.equal(isDisallowedOrigin(request(origin)), true);
    }
  });
});
