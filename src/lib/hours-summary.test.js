import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTrackedDuration, summarizeTrackedSeconds } from './hours-summary.js';

test('sums precise seconds and uses legacy decimal hours when seconds are absent', () => {
  assert.equal(summarizeTrackedSeconds([
    { seconds: 3671, hours: 1.02 },
    { hours: 0.5 },
    { seconds: 0, hours: 0.25 },
    { seconds: -10, hours: -1 },
    { hours: 'invalid' },
  ]), 6371);
});

test('formats tracked time without hiding small entries through two-decimal rounding', () => {
  assert.equal(formatTrackedDuration(0), '0h 00min');
  assert.equal(formatTrackedDuration(48), '0h 00min 48s');
  assert.equal(formatTrackedDuration(1200), '0h 20min');
  assert.equal(formatTrackedDuration(3599), '0h 59min 59s');
  assert.equal(formatTrackedDuration(3600), '1h 00min');
  assert.equal(formatTrackedDuration(3900), '1h 05min');
  assert.equal(formatTrackedDuration(9059), '2h 30min 59s');
});
