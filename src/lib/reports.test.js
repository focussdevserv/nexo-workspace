import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartBuckets, dateOf, inPeriod, periodStart } from './reports.js';

test('year period starts on January 1 instead of a rolling 12-month window', () => {
  const now = new Date(2026, 9, 30, 12);
  assert.equal(periodStart('year', now).getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(inPeriod({ createdAt: '2026-01-01T12:00:00' }, 'year', now, 'created'), true);
  assert.equal(inPeriod({ createdAt: '2025-12-31T23:59:59' }, 'year', now, 'created'), false);
});

test('90-day window includes the start date and excludes the prior day', () => {
  const now = new Date(2026, 8, 30, 12);
  const start = periodStart('quarter', now);
  assert.equal(inPeriod({ createdAt: start.toISOString() }, 'quarter', now, 'created'), true);
  assert.equal(inPeriod({ createdAt: new Date(start.getTime() - 1).toISOString() }, 'quarter', now, 'created'), false);
});

test('date-only values are grouped in the local calendar day without UTC rollover', () => {
  const date = dateOf({ date: '2026-10-01' }, 'expense');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 1);
});

test('annual chart builds calendar-month buckets and sums only real matching records', () => {
  const now = new Date(2026, 9, 30, 12);
  const buckets = buildChartBuckets('year', now, [
    { createdAt: '2026-01-14T12:00:00', amount: 120 },
    { createdAt: '2026-01-28T12:00:00', amount: 30 },
    { createdAt: '2025-12-31T12:00:00', amount: 500 },
    { createdAt: '2026-11-03T12:00:00', amount: 900 },
  ], (row) => row.amount, 'created');
  assert.equal(buckets.length, 12);
  assert.equal(buckets[0].value, 150);
  assert.equal(buckets[9].value, 0);
  assert.equal(buckets[11].value, 0);
});

test('90-day chart uses weekly buckets that cover the full selected range', () => {
  const now = new Date(2026, 8, 30, 12);
  const start = periodStart('quarter', now);
  const buckets = buildChartBuckets('quarter', now, [
    { createdAt: new Date(start.getTime() + 60_000).toISOString(), amount: 25 },
    { createdAt: now.toISOString(), amount: 75 },
    { createdAt: new Date(start.getTime() - 1).toISOString(), amount: 100 },
  ], (row) => row.amount, 'created');
  assert.equal(buckets.length, 13);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.value, 0), 100);
});
