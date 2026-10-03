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

test('rejects manual time entries that end in the future', () => {
  const now = new Date(2026, 9, 3, 10, 0, 0);
  assert.deepEqual(buildManualHoursInterval('2026-10-03', '09:00', '10:30', now), {
    error: 'O término do registro não pode estar no futuro.',
  });
  assert.equal(buildManualHoursInterval('2026-10-03', '09:00', '10:00', now).seconds, 3600);
});

test('interprets manual work times in the workspace timezone instead of the browser timezone', () => {
  const now = new Date('2026-10-03T18:00:00.000Z');
  const result = buildManualHoursInterval('2026-10-03', '09:00', '10:30', now, 'America/Sao_Paulo');
  assert.equal(result.startedAt, '2026-10-03T12:00:00.000Z');
  assert.equal(result.endedAt, '2026-10-03T13:30:00.000Z');
  assert.equal(result.seconds, 5400);
});

test('accepts workspace wall-clock dates that fall on the previous UTC calendar day', () => {
  const now = new Date('2026-10-03T03:00:00.000Z');
  const result = buildManualHoursInterval('2026-10-03', '00:30', '01:30', now, 'Asia/Tokyo');
  assert.equal(result.startedAt, '2026-10-02T15:30:00.000Z');
  assert.equal(result.endedAt, '2026-10-02T16:30:00.000Z');
  assert.equal(result.seconds, 3600);
});

test('rejects a wall-clock time that does not exist because of a workspace daylight-saving transition', () => {
  const result = buildManualHoursInterval('2026-03-08', '01:30', '02:30', new Date('2026-03-09T12:00:00.000Z'), 'America/New_York');
  assert.match(result.error, /n[aã]o existe neste fuso hor[aá]rio/);
});
