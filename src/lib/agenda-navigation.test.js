import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaNavigationEventDate, resolveAgendaNavigationEvent } from './agenda-navigation.js';

test('waits for agenda records before resolving an event navigation context', () => {
  assert.deepEqual(resolveAgendaNavigationEvent([], 'event-1', false), { event: null, consume: false });
});

test('consumes a loaded event context even if the referenced event no longer exists', () => {
  assert.deepEqual(resolveAgendaNavigationEvent([], 'deleted-event', true), { event: null, consume: true });
});

test('matches event identifiers across numeric and string representations', () => {
  const event = { id: 42, title: 'Review' };
  assert.deepEqual(resolveAgendaNavigationEvent([event], '42', true), { event, consume: true });
});

test('waits for Google Calendar read before consuming an external event context', () => {
  assert.deepEqual(resolveAgendaNavigationEvent([], '', true, { googleEventId: 'g-1', googleEventsLoaded: false }), { event: null, consume: false });
});

test('resolves a Google-only event by its provider ID and prefers a linked workspace record', () => {
  const google = { id: 'google-g-1', googleEventId: 'g-1', calendarSource: 'google' };
  const linked = { id: 'workspace-1', googleEventId: 'g-1' };
  assert.deepEqual(resolveAgendaNavigationEvent([], '', true, { googleEventId: 'g-1', googleEvents: [google], googleEventsLoaded: true }), { event: google, consume: true });
  assert.deepEqual(resolveAgendaNavigationEvent([linked], '', true, { googleEventId: 'g-1', googleEvents: [google], googleEventsLoaded: true }), { event: linked, consume: true });
});

test('navigation to an event selects its calendar date and ignores invalid dates', () => {
  assert.equal(agendaNavigationEventDate({ date: '2026-10-03' }), '2026-10-03');
  assert.equal(agendaNavigationEventDate({ date: '2026-02-30' }), null);
  assert.equal(agendaNavigationEventDate({}), null);
});
