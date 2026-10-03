import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGoogleCalendarSyncEvents } from './agenda-google-sync.js';

test('a failed Google Calendar refresh retains the last successfully loaded events', () => {
  const previous = [{ id: 'g-1', title: 'Revisão' }];
  assert.equal(resolveGoogleCalendarSyncEvents(previous, null, new Error('offline')), previous);
});

test('a successful Google Calendar refresh replaces stale records, including with an empty result', () => {
  const previous = [{ id: 'old', title: 'Evento antigo' }];
  const next = [{ id: 'new', title: 'Evento atualizado' }];
  assert.equal(resolveGoogleCalendarSyncEvents(previous, { data: next }), next);
  assert.deepEqual(resolveGoogleCalendarSyncEvents(previous, { data: [] }), []);
});

test('malformed sync payloads safely clear the Google event set', () => {
  assert.deepEqual(resolveGoogleCalendarSyncEvents([{ id: 'old' }], { data: null }), []);
});
