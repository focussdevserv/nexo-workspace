import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaEventDeletionIds, confirmAgendaEventDeletion, deleteAgendaEventSeries } from './agenda-event-series.js';

const events = [
  { id: 'series-a1', recurrenceId: 'series-a' },
  { id: 'single', recurrenceId: '' },
  { id: 'series-a2', recurrenceId: 'series-a' },
  { id: 'series-b1', recurrenceId: 'series-b' },
];

test('deletes only the selected recurring occurrence by default', () => {
  assert.deepEqual(agendaEventDeletionIds(events[0], events), ['series-a1']);
});

test('deletes every occurrence in the selected series without touching other events', () => {
  assert.deepEqual(agendaEventDeletionIds(events[0], events, 'series'), ['series-a1', 'series-a2']);
});

test('does not expand a non-recurring event to a series', () => {
  assert.deepEqual(agendaEventDeletionIds(events[1], events, 'series'), ['single']);
});

test('asks for confirmation exactly once before deleting a non-recurring event', () => {
  const messages = [];
  const shouldDelete = confirmAgendaEventDeletion(events[1], 'occurrence', (message) => { messages.push(message); return true; });
  assert.equal(shouldDelete, true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0], 'Excluir este evento da agenda?');
});

test('deletes linked Google events per occurrence and reports retryable remote failures', async () => {
  const removed = [];
  const deletedGoogle = [];
  const series = [
    { id: 'local-1', googleEventId: 'google-1' },
    { id: 'local-2', googleEventId: 'google-2' },
  ];
  const result = await deleteAgendaEventSeries({
    events: series,
    removeLocal: async (id) => { removed.push(id); return { ok: true }; },
    deleteGoogle: async (id) => { deletedGoogle.push(id); if (id === 'google-2') throw new Error('offline'); },
  });
  assert.deepEqual(removed, ['local-1', 'local-2']);
  assert.deepEqual(deletedGoogle, ['google-1', 'google-2']);
  assert.equal(result.removed, 2);
  assert.equal(result.remotePending, 1);
  assert.equal(result.failed, false);
});

test('stops series deletion after a local failure so remaining occurrences stay intact', async () => {
  const removed = [];
  const result = await deleteAgendaEventSeries({
    events: [{ id: 'local-1' }, { id: 'local-2' }],
    removeLocal: async (id) => { removed.push(id); return { ok: id === 'local-1' ? false : true }; },
    deleteGoogle: async () => assert.fail('Google must not be called when local delete fails'),
  });
  assert.deepEqual(removed, ['local-1']);
  assert.equal(result.removed, 0);
  assert.equal(result.failed, true);
});
