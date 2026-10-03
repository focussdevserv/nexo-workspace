import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardEventsForDate } from './dashboard-events-for-date.js';

test('Meu Dia includes an all-day event on each covered date and respects the exclusive end date', () => {
  const event = { id: 'conference', date: '2026-10-01', endDate: '2026-10-04', allDay: true };
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-01'), [event]);
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-03'), [event]);
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-04'), []);
});

test('Meu Dia keeps timed events on their own workspace date', () => {
  const event = { id: 'meeting', date: '2026-10-02', time: '09:00' };
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-02'), [event]);
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-03'), []);
});

test('Meu Dia derives Google event dates from their instant in the selected timezone', () => {
  const event = { id: 'google', startsAt: '2026-10-02T02:30:00.000Z' };
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-01', 'America/Sao_Paulo'), [event]);
  assert.deepEqual(dashboardEventsForDate([event], '2026-10-02', 'America/Sao_Paulo'), []);
});

test('Meu Dia ignores malformed event records and returns an empty list for invalid input', () => {
  assert.deepEqual(dashboardEventsForDate([null, 'bad', { id: 'event', date: 'invalid' }], '2026-10-02'), []);
  assert.deepEqual(dashboardEventsForDate(null, '2026-10-02'), []);
});
