import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionBillingSubscription, normalizeBillingSubscriptionStatus } from '../src/billing/subscription-transitions.js';

test('subscription lifecycle allows only valid pause, resume, and cancellation transitions', () => {
  assert.equal(canTransitionBillingSubscription('authorized', 'paused'), true);
  assert.equal(canTransitionBillingSubscription('paused', 'authorized'), true);
  assert.equal(canTransitionBillingSubscription('pending', 'canceled'), true);
  assert.equal(canTransitionBillingSubscription('authorized', 'canceled'), true);
  assert.equal(canTransitionBillingSubscription('paused', 'canceled'), true);
  assert.equal(canTransitionBillingSubscription('pending', 'paused'), false);
  assert.equal(canTransitionBillingSubscription('canceled', 'authorized'), false);
  assert.equal(canTransitionBillingSubscription('cancelled', 'paused'), false);
  assert.equal(canTransitionBillingSubscription('expired', 'authorized'), false);
});

test('repeat requests remain idempotent and Mercado Pago cancellation spellings normalize', () => {
  assert.equal(canTransitionBillingSubscription('cancelled', 'canceled'), true);
  assert.equal(canTransitionBillingSubscription('paused', 'paused'), true);
  assert.equal(normalizeBillingSubscriptionStatus('cancelled'), 'canceled');
  assert.equal(normalizeBillingSubscriptionStatus('unknown'), null);
});
