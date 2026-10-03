import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaTimedEventSegmentOnDate, isAgendaEventVisibleInPeriod, isAgendaEventVisibleOnDate } from './agenda-event-visibility.js';

test('all-day events span their exclusive end date in agenda views', () => {
  const event = { date: '2026-10-02', endDate: '2026-10-05', allDay: true };
  assert.equal(isAgendaEventVisibleOnDate(event, '2026-10-02'), true);
  assert.equal(isAgendaEventVisibleOnDate(event, '2026-10-03'), true);
  assert.equal(isAgendaEventVisibleOnDate(event, '2026-10-04'), true);
  assert.equal(isAgendaEventVisibleOnDate(event, '2026-10-05'), false);
  assert.equal(isAgendaEventVisibleOnDate(event, '2026-10-01'), false);
});

test('timed events remain on their start day unless their explicit end date continues after midnight', () => {
  assert.equal(isAgendaEventVisibleOnDate({ date: '2026-10-02', time: '09:00', endDate: '2026-10-04' }, '2026-10-03'), false);
  const overnight = { date: '2026-10-02', time: '23:30', end: '00:30', endDate: '2026-10-03' };
  assert.equal(isAgendaEventVisibleOnDate(overnight, '2026-10-03'), true);
  assert.equal(isAgendaEventVisibleOnDate({ ...overnight, end: '00:00' }, '2026-10-03'), false);
  assert.equal(isAgendaEventVisibleOnDate(overnight, '2026-10-04'), false);
  assert.equal(isAgendaEventVisibleOnDate({ date: '2026-10-02', allDay: true }, '2026-10-02'), true);
  assert.equal(isAgendaEventVisibleOnDate({ date: '2026-10-02', allDay: true }, '2026-10-03'), false);
});

test('overnight timed events appear in the next day and period totals only for their remaining interval', () => {
  const event = { date: '2026-10-02', time: '23:30', end: '09:15', endDate: '2026-10-03' };
  assert.equal(isAgendaEventVisibleInPeriod(event, '2026-10-03', '2026-10-09'), true);
  assert.deepEqual(agendaTimedEventSegmentOnDate(event, '2026-10-03'), {
    startMinutes: 420,
    endMinutes: 555,
    continuesFromPreviousDay: true,
    continuesAfterGrid: false,
  });
  assert.equal(agendaTimedEventSegmentOnDate(event, '2026-10-02'), null);
});

test('invalid event/date keys never appear in an agenda cell', () => {
  assert.equal(isAgendaEventVisibleOnDate({ date: 'not-a-date', allDay: true }, '2026-10-02'), false);
  assert.equal(isAgendaEventVisibleOnDate({ date: '2026-10-02', allDay: true }, 'October 2'), false);
});

test('period summary includes an all-day event already in progress at its start date', () => {
  const event = { date: '2026-09-30', endDate: '2026-10-03', allDay: true };
  assert.equal(isAgendaEventVisibleInPeriod(event, '2026-10-01', '2026-10-31'), true);
  assert.equal(isAgendaEventVisibleInPeriod(event, '2026-10-03', '2026-10-09'), false);
  assert.equal(isAgendaEventVisibleInPeriod({ ...event, date: '2026-10-05' }, '2026-10-01', '2026-10-31'), true);
});
