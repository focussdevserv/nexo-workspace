import test from 'node:test';
import assert from 'node:assert/strict';
import { isBillingOrderCancelable } from '../src/billing/order-cancellation.js';

test('only unpaid orders in provider-cancelable states can be canceled', () => {
  assert.equal(isBillingOrderCancelable('pending', 'created'), true);
  assert.equal(isBillingOrderCancelable('pending', 'action_required'), true);
  assert.equal(isBillingOrderCancelable('paid', 'processed'), false);
  assert.equal(isBillingOrderCancelable('pending', 'processed'), false);
  assert.equal(isBillingOrderCancelable('cancelled', 'canceled'), false);
});
