import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubscriptionSchedule, minimumSubscriptionEndDate } from './subscription-schedule.js';

test('builds first and final charge timestamps in the São Paulo calendar', () => {
  assert.deepEqual(buildSubscriptionSchedule('2026-10-10', '2027-10-10'), {
    startAt: '2026-10-10T09:00:00-03:00',
    endAt: '2027-10-10T23:59:59-03:00',
  });
});

test('allows an open-ended recurring schedule when no end date is selected', () => {
  assert.deepEqual(buildSubscriptionSchedule('2026-10-10'), {
    startAt: '2026-10-10T09:00:00-03:00',
  });
});

test('rejects invalid dates and an end date on or before the first charge', () => {
  assert.throws(() => buildSubscriptionSchedule('2026-02-30'), /subscription_start_date_invalid/);
  assert.throws(() => buildSubscriptionSchedule('2026-10-10', '2026-10-10'), /subscription_end_date_invalid/);
  assert.throws(() => buildSubscriptionSchedule('2026-10-10', '2026-10-09'), /subscription_end_date_invalid/);
});

test('sets the earliest end date to the day after the first charge, including month and year boundaries', () => {
  assert.equal(minimumSubscriptionEndDate('2026-10-10'), '2026-10-11');
  assert.equal(minimumSubscriptionEndDate('2026-12-31'), '2027-01-01');
  assert.equal(minimumSubscriptionEndDate('2028-02-28'), '2028-02-29');
  assert.equal(minimumSubscriptionEndDate('2026-02-30'), '');
});
