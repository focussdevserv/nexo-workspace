import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAgendaNavigationEvent } from './agenda-navigation.js';

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
