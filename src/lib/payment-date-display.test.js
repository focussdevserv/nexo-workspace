import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPaymentDate } from './payment-date-display.js';

test('formats end-of-day provider timestamps as the intended São Paulo due date', () => {
  assert.equal(formatPaymentDate('2026-10-04T02:59:59.000Z'), '03/10/2026');
});

test('keeps date-only payment values on their selected calendar day', () => {
  assert.equal(formatPaymentDate('2026-10-03'), '03/10/2026');
});

test('returns an empty value for missing or invalid provider dates', () => {
  assert.equal(formatPaymentDate(''), '');
  assert.equal(formatPaymentDate('2026-02-30'), '');
});
