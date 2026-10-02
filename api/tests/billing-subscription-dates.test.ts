import assert from 'node:assert/strict';
import test from 'node:test';
import { subscriptionDateTimeSchema, validateSubscriptionDates } from '../src/billing/subscription-dates.js';

const now = Date.parse('2026-10-02T12:00:00.000Z');

test('allows a future first charge and a later end date', () => {
  assert.equal(validateSubscriptionDates('2026-10-03T12:00:00.000Z', '2027-10-03T12:00:00.000Z', now), null);
});

test('accepts ISO timestamps with the São Paulo offset sent by the billing form', () => {
  const startAt = '2026-10-10T09:00:00-03:00';
  const endAt = '2027-10-10T23:59:59-03:00';
  assert.equal(subscriptionDateTimeSchema.safeParse(startAt).success, true);
  assert.equal(subscriptionDateTimeSchema.safeParse(endAt).success, true);
  assert.equal(subscriptionDateTimeSchema.safeParse('2026-10-10 09:00:00').success, false);
});

test('rejects a first charge in the past or at the current instant', () => {
  assert.equal(validateSubscriptionDates('2026-10-02T11:59:59.000Z', undefined, now), 'start_in_past');
  assert.equal(validateSubscriptionDates('2026-10-02T12:00:00.000Z', undefined, now), 'start_in_past');
});

test('requires an end date to be later than the first charge', () => {
  assert.equal(validateSubscriptionDates('2026-10-03T12:00:00.000Z', '2026-10-03T11:00:00.000Z', now), 'end_before_start');
});
