import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInboxConversationPatch } from './inbox-conversation-patch.js';

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
