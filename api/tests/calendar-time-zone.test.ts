import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidCalendarTimeZone, localDateTimeToIso, nextCalendarDate } from '../src/integrations/calendar-time-zone.js';

test('converts selected local calendar hours to UTC for different workspace timezones', () => {
  assert.equal(localDateTimeToIso('2026-01-10', '10:00', 'America/New_York'), '2026-01-10T15:00:00.000Z');
  assert.equal(localDateTimeToIso('2026-07-10', '10:00', 'America/New_York'), '2026-07-10T14:00:00.000Z');
});

test('validates IANA timezones and advances all-day date ranges as calendar dates', () => {
  assert.equal(isValidCalendarTimeZone('Asia/Tokyo'), true);
  assert.equal(isValidCalendarTimeZone('No/Such_Zone'), false);
  assert.equal(nextCalendarDate('2026-12-31'), '2027-01-01');
});
