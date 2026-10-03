import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultManualHoursDate, formatHoursEntryEnd, hoursDateRange, hoursEntryIsInDateRange, hoursEntryLocalDate } from './hours-entry-date.js';

test('manual Hours entry defaults to the workspace date across midnight boundaries', () => {
  const now = new Date('2026-10-03T02:30:00.000Z');
  assert.equal(defaultManualHoursDate(now, 'America/Sao_Paulo'), '2026-10-02');
  assert.equal(defaultManualHoursDate(now, 'Asia/Tokyo'), '2026-10-03');
});

test('classifies timestamped hours in the workspace timezone, independent of browser timezone', () => {
  assert.equal(hoursEntryLocalDate({ endedAt: '2026-10-03T02:00:00.000Z' }, 'America/Sao_Paulo'), '2026-10-02');
  assert.equal(hoursEntryLocalDate({ endedAt: '2026-10-03T02:00:00.000Z' }, 'Asia/Tokyo'), '2026-10-03');
});

test('preserves date-only manual entries and falls back to the start time', () => {
  assert.equal(hoursEntryLocalDate({ date: '2026-10-02', endedAt: '2026-10-03T01:00:00.000Z' }), '2026-10-02');
  assert.equal(hoursEntryLocalDate({ startedAt: '2026-10-03T02:00:00.000Z' }, 'America/Sao_Paulo'), '2026-10-02');
  assert.equal(hoursEntryLocalDate({ endedAt: 'invalid' }), '');
});

test('attributes overnight timer entries to the date work started', () => {
  const entry = {
    startedAt: '2026-10-02T23:30:00.000Z',
    endedAt: '2026-10-03T01:00:00.000Z',
  };
  assert.equal(hoursEntryLocalDate(entry, 'UTC'), '2026-10-02');
  assert.equal(hoursEntryIsInDateRange(entry, 'UTC', '2026-10-02', '2026-10-02'), true);
  assert.equal(hoursEntryIsInDateRange(entry, 'UTC', '2026-10-03', '2026-10-03'), false);
});

test('hours date ranges follow the workspace calendar near UTC midnight', () => {
  const instant = new Date('2026-10-02T01:30:00.000Z');
  assert.deepEqual(hoursDateRange('Esta semana', instant, 'America/Sao_Paulo'), ['2026-09-28', '2026-10-01']);
  assert.deepEqual(hoursDateRange('Semana passada', instant, 'America/Sao_Paulo'), ['2026-09-21', '2026-09-27']);
  assert.deepEqual(hoursDateRange('Este mês', instant, 'America/Sao_Paulo'), ['2026-10-01', '2026-10-01']);
  assert.deepEqual(hoursDateRange('Esta semana', instant, 'Asia/Tokyo'), ['2026-09-28', '2026-10-02']);
});

test('excludes completed entries without a usable date from period views', () => {
  const range = ['2026-10-01', '2026-10-03'];
  assert.equal(hoursEntryIsInDateRange({ endedAt: '2026-10-02T15:00:00.000Z' }, 'America/Sao_Paulo', ...range), true);
  assert.equal(hoursEntryIsInDateRange({ endedAt: 'invalid' }, 'America/Sao_Paulo', ...range), false);
  assert.equal(hoursEntryIsInDateRange({}, 'America/Sao_Paulo', ...range), false);
});

test('hours date ranges honor a Sunday workspace week start', () => {
  const instant = new Date('2026-10-04T15:00:00.000Z');
  assert.deepEqual(hoursDateRange('Esta semana', instant, 'America/Sao_Paulo', 'sunday'), ['2026-10-04', '2026-10-04']);
  assert.deepEqual(hoursDateRange('Semana passada', instant, 'America/Sao_Paulo', 'sunday'), ['2026-09-27', '2026-10-03']);
});

test('last hour display uses the workspace timezone', () => {
  const instant = '2026-10-03T02:00:00.000Z';
  assert.match(formatHoursEntryEnd(instant, 'America/Sao_Paulo'), /02\/10\/2026, 23:00/);
  assert.match(formatHoursEntryEnd(instant, 'Asia/Tokyo'), /03\/10\/2026, 11:00/);
  assert.equal(formatHoursEntryEnd('invalid', 'America/Sao_Paulo'), '—');
});
