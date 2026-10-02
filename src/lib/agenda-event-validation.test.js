import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgendaAttendees, validateAgendaAttendees, validateAgendaEvent } from './agenda-event-validation.js';

test('validates calendar dates including leap days', () => {
  assert.equal(validateAgendaEvent({ date: '2028-02-29', allDay: true }), '');
  assert.match(validateAgendaEvent({ date: '2027-02-29', allDay: true }), /data válida/);
});

test('allows all-day events without times and requires a positive timed interval', () => {
  assert.equal(validateAgendaEvent({ date: '2026-10-02', allDay: true }), '');
  assert.match(validateAgendaEvent({ date: '2026-10-02', time: '10:00', end: '' }), /horário/);
  assert.match(validateAgendaEvent({ date: '2026-10-02', time: '10:30', end: '10:30' }), /posterior/);
  assert.equal(validateAgendaEvent({ date: '2026-10-02', time: '10:00', end: '10:30' }), '');
});

test('keeps valid unique attendees and rejects malformed addresses instead of silently dropping them', () => {
  assert.deepEqual(parseAgendaAttendees('ana@example.com, Bia@example.com; ana@example.com'), {
    attendees: ['ana@example.com', 'Bia@example.com'],
    invalid: [],
  });
  assert.match(validateAgendaAttendees('ana@example.com, ana@'), /ana@/);
  assert.equal(validateAgendaAttendees(''), '');
});

test('rejects a malformed edited attendee list before calendar sync can discard an address', () => {
  assert.match(validateAgendaAttendees('ana@example.com, equipe@'), /equipe@/);
  assert.deepEqual(parseAgendaAttendees('ana@example.com; Bia@example.com'), {
    attendees: ['ana@example.com', 'Bia@example.com'],
    invalid: [],
  });
});
