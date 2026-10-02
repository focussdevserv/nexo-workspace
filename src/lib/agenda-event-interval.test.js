import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaEventDurationMinutes, agendaEventEndDate } from './agenda-event-interval.js';

test('overnight agenda events end on the following civil date', () => {
  assert.equal(agendaEventEndDate('2026-12-31', '23:30', '00:30'), '2027-01-01');
  assert.equal(agendaEventEndDate('2026-10-02', '09:00', '10:00'), '2026-10-02');
});

test('timed agenda duration wraps across midnight and rejects equal or malformed times', () => {
  assert.equal(agendaEventDurationMinutes('23:30', '00:30'), 60);
  assert.equal(agendaEventDurationMinutes('09:15', '10:45'), 90);
  assert.equal(agendaEventDurationMinutes('09:00', '09:00'), 0);
  assert.equal(agendaEventDurationMinutes('bad', '10:00'), 0);
});
