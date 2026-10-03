import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxReadPatch, markInboxConversationRead } from './inbox-read-state.js';

test('builds a minimal workspace patch to mark a conversation read', () => {
  const source = { id: 'conversation-1', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T11:00:00Z', name: 'Ana', unread: 3, channel: 'WhatsApp' };
  assert.deepEqual(buildInboxReadPatch(source), { unread: 0 });
  assert.equal(source.unread, 3, 'the original record remains unchanged');
});

test('does not send a stale conversation snapshot when marking it read', () => {
  const patch = buildInboxReadPatch({
    id: 'conversation-1', unread: 2,
    history: [{ text: 'old snapshot' }], owner: 'Ana',
  });
  assert.deepEqual(patch, { unread: 0 });
  assert.equal('history' in patch, false);
  assert.equal('owner' in patch, false);
});

test('persists the read state once before refreshing the workspace record', async () => {
  const calls = [];
  const result = await markInboxConversationRead({ id: 'conversation-3', name: 'Ana', unread: 2 }, {
    update: async (patch) => calls.push(['update', patch]),
    refresh: async () => calls.push(['refresh']),
  });

  assert.deepEqual(calls, [['update', { unread: 0 }], ['refresh']]);
  assert.deepEqual(result, { refreshed: true });
});

test('reports refresh failure separately after the read was saved', async () => {
  let updates = 0;
  const result = await markInboxConversationRead({ id: 'conversation-4', unread: 1 }, {
    update: async () => { updates += 1; },
    refresh: async () => { throw new Error('temporary read failure'); },
  });

  assert.equal(updates, 1);
  assert.deepEqual(result, { refreshed: false });
});

test('does not refresh if persisting the read state fails', async () => {
  let refreshes = 0;
  await assert.rejects(markInboxConversationRead({ id: 'conversation-5', unread: 1 }, {
    update: async () => { throw new Error('update failed'); },
    refresh: async () => { refreshes += 1; },
  }), /update failed/);
  assert.equal(refreshes, 0);
});

test('marks a conversation read even when its old unread count is absent', () => {
  assert.deepEqual(buildInboxReadPatch({ id: 'conversation-2', text: 'Olá' }), { unread: 0 });
});
