import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCommodityNodeAccountService } from '../src/services/commoditynode-product';

test('account service requires both public Convex and Clerk configuration', () => {
  assert.equal(hasCommodityNodeAccountService({}), false);
  assert.equal(
    hasCommodityNodeAccountService({
      convexUrl: 'https://example.convex.cloud',
    }),
    false,
  );
  assert.equal(
    hasCommodityNodeAccountService({
      clerkPublishableKey: 'pk_test_example',
    }),
    false,
  );
  assert.equal(
    hasCommodityNodeAccountService({
      convexUrl: '   ',
      clerkPublishableKey: 'pk_test_example',
    }),
    false,
  );
  assert.equal(
    hasCommodityNodeAccountService({
      convexUrl: 'https://example.convex.cloud',
      clerkPublishableKey: 'pk_test_example',
    }),
    true,
  );
});
