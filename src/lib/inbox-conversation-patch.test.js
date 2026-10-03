import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInboxConversationPatch, saveInboxConversationMetadata } from './inbox-conversation-patch.js';

test('assignment patch updates only the assignee fields', () => {
  assert.deepEqual(buildInboxConversationPatch({ owner: 'Ana', assigneeId: 'user-1' }), {
    owner: 'Ana', assigneeId: 'user-1',
  });
});

test('status patch does not include stale conversation or message history fields', () => {
  const patch = buildInboxConversationPatch({
    status: 'closed', text: 'old preview', history: [{ text: 'old message' }],
    unread: 3,
  });
  assert.deepEqual(patch, { status: 'closed' });
});

test('clearing assignment persists empty fields without sending unrelated data', () => {
  assert.deepEqual(buildInboxConversationPatch({ owner: '', assigneeId: '' }), {
    owner: '', assigneeId: '',
  });
});

test('a saved assignment remains successful when refreshing the inbox fails', async () => {
  const calls = [];
  const result = await saveInboxConversationMetadata({
    save: async () => { calls.push('save'); return { data: { id: 'conversation-1' } }; },
    updateLocal: () => calls.push('local'),
    refresh: async () => { calls.push('refresh'); throw new Error('temporary read outage'); },
  });
  assert.deepEqual(calls, ['save', 'local', 'refresh']);
  assert.deepEqual(result, { result: { data: { id: 'conversation-1' } }, refreshed: false });
});

test('a metadata write failure never updates local conversation state', async () => {
  let updatedLocally = false;
  await assert.rejects(saveInboxConversationMetadata({
    save: async () => { throw new Error('permission denied'); },
    updateLocal: () => { updatedLocally = true; },
    refresh: async () => {},
  }), /permission denied/);
  assert.equal(updatedLocally, false);
});
