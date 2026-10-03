import assert from 'node:assert/strict';
import test from 'node:test';
import {
  subscriptionCycleChoice,
  subscriptionCycleFromChoice,
  subscriptionCyclePayload,
  validateSubscriptionCycle,
} from './subscription-cycle.js';

test('known billing periods are selected as presets and map to API cycle fields', () => {
  assert.equal(subscriptionCycleChoice('months', 1), 'months:1');
  assert.equal(subscriptionCycleChoice('days', 7), 'days:7');
  assert.deepEqual(subscriptionCycleFromChoice('months:3'), { frequency: 'months', frequencyInterval: 3 });
  assert.deepEqual(subscriptionCyclePayload('days', '7'), { frequency: 'days', frequencyInterval: 7 });
});

test('custom recurring intervals preserve the selected unit and interval', () => {
  assert.equal(subscriptionCycleChoice('months', 2), 'custom');
  assert.deepEqual(subscriptionCycleFromChoice('custom'), { frequency: 'months', frequencyInterval: 2 });
  assert.deepEqual(subscriptionCyclePayload('days', '14'), { frequency: 'days', frequencyInterval: 14 });
  assert.deepEqual(subscriptionCyclePayload('months', '2'), { frequency: 'months', frequencyInterval: 2 });
});

test('rejects unsupported cycle units and intervals outside the API range', () => {
  assert.equal(validateSubscriptionCycle('weeks', 1), 'subscription_frequency_invalid');
  for (const interval of ['', '1.5', 0, 25, 'not-a-number']) {
    assert.equal(validateSubscriptionCycle('months', interval), 'subscription_interval_invalid');
    assert.throws(() => subscriptionCyclePayload('months', interval));
  }
  assert.throws(() => subscriptionCycleFromChoice('not-a-choice'));
});
