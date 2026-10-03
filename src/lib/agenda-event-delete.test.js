import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteAgendaEvent } from './agenda-event-delete.js';

test('keeps the local event and Google link when local deletion fails', async () => {
  const calls = [];
  const result = await deleteAgendaEvent({
    event: { id: 'local-1', googleEventId: 'google-1' },
    removeLocal: async () => ({ ok: false, error: new Error('database unavailable') }),
    deleteGoogle: async (id) => calls.push(`google:${id}`),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'local_delete_failed');
  assert.deepEqual(calls, []);
});

test('removes a linked local event first and reports when Google deletion needs retry', async () => {
  const calls = [];
  const result = await deleteAgendaEvent({
    event: { id: 'local-1', googleEventId: 'google-1' },
    removeLocal: async (id) => { calls.push(`local:${id}`); return { ok: true }; },
    deleteGoogle: async (id) => { calls.push(`google:${id}`); throw new Error('provider unavailable'); },
  });

  assert.equal(result.ok, true);
  assert.equal(result.remotePending, true);
  assert.deepEqual(calls, ['local:local-1', 'google:google-1']);
});

test('keeps Google-only events available for retry when remote deletion fails', async () => {
  const calls = [];
  const result = await deleteAgendaEvent({
    event: { id: 'google-1', googleEventId: 'google-1', calendarSource: 'google' },
    removeLocal: async () => { calls.push('local'); return { ok: true }; },
    deleteGoogle: async (id) => { calls.push(`google:${id}`); throw new Error('provider unavailable'); },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'google_delete_failed');
  assert.deepEqual(calls, ['google:google-1']);
});
