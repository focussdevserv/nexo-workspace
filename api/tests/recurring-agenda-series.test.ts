import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringAgendaSeriesMatches, validateRecurringAgendaSeries } from '../src/agenda/recurring-series.ts';

function entries(recurrence = 'daily', dates = ['2026-10-03', '2026-10-04']) {
  return dates.map((date, index) => ({ clientId: `local-${index + 1}`, data: {
    title: 'Revisão semanal', date, endDate: date, recurrence, recurrenceId: 'series-1',
    recurrenceSequence: index + 1, recurrenceCount: dates.length, time: '10:00', end: '10:30', allDay: false,
  } }));
}

test('accepts complete daily, weekly, and monthly series with a stable monthly anchor', () => {
  assert.equal(validateRecurringAgendaSeries('series-1', entries()), true);
  assert.equal(validateRecurringAgendaSeries('series-1', entries('weekly', ['2026-10-03', '2026-10-10'])), true);
  const monthly = entries('monthly', ['2026-01-31', '2026-02-28', '2026-03-31']);
  monthly.forEach((entry) => { entry.data.recurrenceCount = 3; });
  assert.equal(validateRecurringAgendaSeries('series-1', monthly), true);
});

test('rejects malformed dates, wrong series metadata, duplicate client IDs, and incomplete counts', () => {
  assert.equal(validateRecurringAgendaSeries('series-1', entries('daily', ['2026-02-30', '2026-03-01'])), false);
  const wrongSeries = entries();
  wrongSeries[1]!.data.recurrenceId = 'other';
  assert.equal(validateRecurringAgendaSeries('series-1', wrongSeries), false);
  const duplicateIds = entries();
  duplicateIds[1]!.clientId = duplicateIds[0]!.clientId;
  assert.equal(validateRecurringAgendaSeries('series-1', duplicateIds), false);
  assert.equal(validateRecurringAgendaSeries('series-1', [entries()[0]!]), false);
});

test('recognizes an idempotent replay but rejects an altered recurrence', () => {
  const source = entries();
  const existing = source.map((entry) => ({ data: { ...entry.data } }));
  assert.equal(recurringAgendaSeriesMatches(existing, source), true);
  assert.equal(recurringAgendaSeriesMatches(existing, entries('weekly', ['2026-10-03', '2026-10-10'])), false);
});
