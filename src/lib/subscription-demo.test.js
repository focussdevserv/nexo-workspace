import assert from 'node:assert/strict';
import test from 'node:test';
import { canSimulateSubscriptionAuthorization } from './subscription-demo.js';

test('only pending local demo subscriptions can simulate customer authorization', () => {
  assert.equal(canSimulateSubscriptionAuthorization({ status: 'pending' }, true), true);
  assert.equal(canSimulateSubscriptionAuthorization({ status: 'PENDING' }, true), true);
  assert.equal(canSimulateSubscriptionAuthorization({ status: 'authorized' }, true), false);
  assert.equal(canSimulateSubscriptionAuthorization({ status: 'pending' }, false), false);
  assert.equal(canSimulateSubscriptionAuthorization(null, true), false);
});
