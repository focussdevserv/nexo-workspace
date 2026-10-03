import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgendaRecurrenceSeries } from './agenda-recurrence.js';

test('builds a bounded daily series with unique records and internal-only sync state', () => {
  const events = buildAgendaRecurrenceSeries({ id: 'event-1', date: '2026-10-02', time: '09:00', end: '09:30', endDate: '2026-10-02' }, {
    recurrence: 'daily', count: 3, seriesId: 'series-1', makeId: (sequence) => `event-${sequence + 1}`,
  });
  assert.deepEqual(events.map(({ date, recurrenceSequence }) => [date, recurrenceSequence]), [['2026-10-02', 1], ['2026-10-03', 2], ['2026-10-04', 3]]);
  assert.equal(events[2].endDate, '2026-10-04');
  assert.equal(events[1].recurrenceId, 'series-1');
  assert.equal(events[1].calendarSyncStatus, 'internal_only');
  assert.equal(events[1].googleEventId, '');
});

test('keeps month-end recurrence anchored across short months and handles all-day end dates', () => {
  const events = buildAgendaRecurrenceSeries({ id: 'event-31', date: '2026-01-31', endDate: '2026-02-01', allDay: true }, {
    recurrence: 'monthly', count: 3, seriesId: 'series-month', makeId: (sequence) => `month-${sequence}`,
  });
  assert.deepEqual(events.map((event) => [event.date, event.endDate]), [['2026-01-31', '2026-02-01'], ['2026-02-28', '2026-03-01'], ['2026-03-31', '2026-04-01']]);
});

test('creates no extra occurrence for one-time events and clamps count', () => {
  assert.equal(buildAgendaRecurrenceSeries({ id: 'once', date: '2026-10-02' }, { recurrence: 'none', count: 12 }).length, 1);
  assert.equal(buildAgendaRecurrenceSeries({ id: 'repeat', date: '2026-10-02' }, { recurrence: 'weekly', count: 500 }).length, 52);
  assert.throws(() => buildAgendaRecurrenceSeries({ id: 'bad' }), /data válida/);
});
