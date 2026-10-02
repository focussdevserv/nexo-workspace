import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentDueDateAtEndOfDay, paymentDueDateDuration } from '../src/billing/due-date.js';

const now = new Date('2026-10-02T15:00:00.000Z'); // 12:00 in São Paulo

test('custom payment due date maps to the provider duration', () => {
  assert.deepEqual(paymentDueDateDuration('2026-10-03', now), { days: 1, duration: 'P1D' });
  assert.deepEqual(paymentDueDateDuration('2026-11-01', now), { days: 30, duration: 'P30D' });
});

test('rejects dates outside the supported window and invalid calendar dates', () => {
  assert.equal(paymentDueDateDuration('2026-10-02', now), null);
  assert.equal(paymentDueDateDuration('2026-11-02', now), null);
  assert.equal(paymentDueDateDuration('2026-02-30', now), null);
  assert.equal(paymentDueDateDuration('not-a-date', now), null);
});

test('stores the selected local deadline when the provider omits its expiration timestamp', () => {
  assert.equal(paymentDueDateAtEndOfDay('2026-10-03')?.toISOString(), '2026-10-04T02:59:59.000Z');
  assert.equal(paymentDueDateAtEndOfDay('2026-02-30'), null);
  assert.equal(paymentDueDateAtEndOfDay('not-a-date'), null);
});
