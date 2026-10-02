import test from 'node:test';
import assert from 'node:assert/strict';
import { isAgendaAllDayEvent } from './agenda-event-presentation.js';

test('an event changed to all-day remains in the all-day row even if old times are retained', () => {
  assert.equal(isAgendaAllDayEvent({ allDay: true, time: '14:00', end: '15:00' }), true);
});

test('legacy events without a time remain all-day and timed events stay in the time grid', () => {
  assert.equal(isAgendaAllDayEvent({ date: '2026-10-02' }), true);
  assert.equal(isAgendaAllDayEvent({ allDay: false, time: '14:00', end: '15:00' }), false);
});
