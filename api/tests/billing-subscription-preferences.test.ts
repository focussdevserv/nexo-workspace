import test from 'node:test';
import assert from 'node:assert/strict';
import { billingSubscriptionPreferenceAllows } from '../src/billing/subscription-preferences.js';

test('missing recurring billing preferences keep subscriptions enabled by default', () => {
  assert.equal(billingSubscriptionPreferenceAllows(undefined), true);
  assert.equal(billingSubscriptionPreferenceAllows(null), true);
  assert.equal(billingSubscriptionPreferenceAllows({}), true);
});

test('explicitly disabled recurring billing blocks new subscriptions', () => {
  assert.equal(billingSubscriptionPreferenceAllows({ autoRenew: false }), false);
  assert.equal(billingSubscriptionPreferenceAllows({ autoRenew: true }), true);
});

test('malformed preference values do not unexpectedly lock an existing workspace', () => {
  assert.equal(billingSubscriptionPreferenceAllows([]), true);
  assert.equal(billingSubscriptionPreferenceAllows('disabled'), true);
});
