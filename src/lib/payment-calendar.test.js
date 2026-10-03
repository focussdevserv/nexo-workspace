import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentDateAfterDays } from './payment-calendar.js';

test('payment date defaults follow the workspace calendar rather than the computer timezone', () => {
  // 01:30 UTC is still 22:30 on the previous day in Sao Paulo.
  const nearUtcMidnight = new Date('2026-10-03T01:30:00.000Z');
  assert.equal(paymentDateAfterDays(0, nearUtcMidnight), '2026-10-02');
  assert.equal(paymentDateAfterDays(1, nearUtcMidnight), '2026-10-03');
  assert.equal(paymentDateAfterDays(7, nearUtcMidnight), '2026-10-09');
});

test('payment date arithmetic handles month and year boundaries', () => {
  assert.equal(paymentDateAfterDays(1, new Date('2026-12-31T15:00:00.000Z')), '2027-01-01');
  assert.equal(paymentDateAfterDays(1, new Date('2028-02-28T15:00:00.000Z')), '2028-02-29');
});
