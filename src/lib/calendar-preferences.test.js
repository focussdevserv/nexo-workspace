import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDateInTimeZone, calendarDateKeyForValue, calendarDateKeyInTimeZone, calendarTimeInTimeZone, calendarWeekdayLabels, normalizeCalendarTimeZone, parseCalendarDateKey, startOfCalendarWeek } from './calendar-preferences.js';

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

test('workspace timezone determines the agenda civil date at day boundaries', () => {
  const instant = new Date('2026-10-02T01:30:00.000Z');
  assert.equal(localDateKey(calendarDateInTimeZone(instant, 'America/Sao_Paulo')), '2026-10-01');
  assert.equal(localDateKey(calendarDateInTimeZone(instant, 'Asia/Tokyo')), '2026-10-02');
  assert.equal(normalizeCalendarTimeZone('not/a-timezone'), 'America/Sao_Paulo');
});

test('workspace date and clock helpers keep Meu Dia aligned to the workspace timezone', () => {
  const instant = new Date('2026-10-02T01:30:00.000Z');
  assert.equal(calendarDateKeyInTimeZone(instant, 'America/Sao_Paulo'), '2026-10-01');
  assert.equal(calendarDateKeyInTimeZone(instant, 'Asia/Tokyo'), '2026-10-02');
  assert.equal(calendarDateKeyForValue('2026-10-02', 'America/Sao_Paulo'), '2026-10-02');
  assert.equal(calendarDateKeyForValue(instant.toISOString(), 'America/Sao_Paulo'), '2026-10-01');
  assert.equal(calendarTimeInTimeZone(instant, 'America/Sao_Paulo'), '22:30');
  assert.equal(calendarTimeInTimeZone(instant, 'Asia/Tokyo'), '10:30');
});

test('calendar weeks begin on the workspace-selected weekday', () => {
  const date = new Date(2026, 9, 7);
  assert.equal(localDateKey(startOfCalendarWeek(date, 'monday')), '2026-10-05');
  assert.equal(localDateKey(startOfCalendarWeek(date, 'sunday')), '2026-10-04');
  assert.deepEqual(calendarWeekdayLabels('en-US', 'sunday').map((label) => label.slice(0, 2)), ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
  assert.deepEqual(calendarWeekdayLabels('en-US', 'monday').map((label) => label.slice(0, 2)), ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
});

test('strict calendar keys preserve years below 100 and reject impossible dates', () => {
  assert.equal(parseCalendarDateKey('0001-01-01')?.getUTCFullYear(), 1);
  assert.equal(parseCalendarDateKey('0099-12-31')?.getUTCFullYear(), 99);
  assert.equal(parseCalendarDateKey('2024-02-29')?.getUTCDate(), 29);
  assert.equal(parseCalendarDateKey('2025-02-29'), null);
  assert.equal(parseCalendarDateKey('0100-13-01'), null);
});
