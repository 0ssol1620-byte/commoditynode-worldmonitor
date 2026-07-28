import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMODITYNODE_API_SCOPES,
  COMMODITYNODE_CHECKOUT_GATES,
  COMMODITYNODE_PLANS,
  commodityNodeCheckoutActivation,
  validateCommodityNodeCommercialContract,
} from '../shared/commoditynode-commercial-contract';

test('CommodityNode commercial contract is internally valid and checkout fails closed', () => {
  assert.deepEqual(validateCommodityNodeCommercialContract(), []);
  assert.equal(COMMODITYNODE_PLANS.professionalCandidate.saleState, 'not_for_sale');
  const activation = commodityNodeCheckoutActivation(COMMODITYNODE_CHECKOUT_GATES);
  assert.equal(activation.enabled, false);
  assert.equal(activation.blockers.length, 6);
});

test('checkout activates only when every independently named gate passes', () => {
  const activation = commodityNodeCheckoutActivation({
    productFactsVerified: true,
    paidFeaturesEndToEndTested: true,
    legalTermsPublished: true,
    privacyRuntimeVerified: true,
    refundAndSupportOwnerAssigned: true,
    productionWebhookReconciled: true,
  });
  assert.deepEqual(activation, { enabled: true, blockers: [] });
});

test('public and candidate paid API scopes and quotas are explicit', () => {
  assert.ok(COMMODITYNODE_API_SCOPES.public.includes('commodity.evidence.read'));
  assert.ok(COMMODITYNODE_API_SCOPES.paidCandidate.includes('commodity.graph.export'));
  assert.equal(COMMODITYNODE_PLANS.public.entitlements.apiDailyRequests, 100);
  assert.equal(COMMODITYNODE_PLANS.professionalCandidate.entitlements.apiDailyRequests, 10_000);
});
