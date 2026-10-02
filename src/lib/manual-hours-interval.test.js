import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManualHoursInterval } from './manual-hours-interval.js';

test('builds a normal manual time entry from the selected local date and times', () => {
  const result = buildManualHoursInterval('2026-10-02', '09:15', '10:45');
  assert.equal(result.startedAt, new Date(2026, 9, 2, 9, 15).toISOString());
  assert.equal(result.endedAt, new Date(2026, 9, 2, 10, 45).toISOString());
  assert.equal(result.seconds, 5400);
});

test('records an end time earlier than the start on the following day', () => {
  const result = buildManualHoursInterval('2026-10-02', '23:30', '00:45');
  assert.equal(result.startedAt, new Date(2026, 9, 2, 23, 30).toISOString());
  assert.equal(result.endedAt, new Date(2026, 9, 3, 0, 45).toISOString());
  assert.equal(result.seconds, 4500);
});

test('rejects invalid calendar dates, times, and equal endpoints', () => {
  assert.match(buildManualHoursInterval('2026-02-30', '09:00', '10:00').error, /data/);
  assert.match(buildManualHoursInterval('2026-10-02', '25:00', '10:00').error, /data e horários/);
  assert.match(buildManualHoursInterval('2026-10-02', '09:00', '09:00').error, /iguais/);
});
