import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringBillingEnabled } from './billing-preferences.js';

test('recurring billing stays enabled for legacy or missing preferences', () => {
  assert.equal(recurringBillingEnabled(undefined), true);
  assert.equal(recurringBillingEnabled({}), true);
});

test('recurring billing follows the explicit workspace switch', () => {
  assert.equal(recurringBillingEnabled({ autoRenew: true }), true);
  assert.equal(recurringBillingEnabled({ autoRenew: false }), false);
});
