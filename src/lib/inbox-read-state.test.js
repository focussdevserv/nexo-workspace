import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxReadPatch } from './inbox-read-state.js';

test('builds a workspace patch that marks a conversation read without immutable fields', () => {
  const source = { id: 'conversation-1', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T11:00:00Z', name: 'Ana', unread: 3, channel: 'WhatsApp' };
  assert.deepEqual(buildInboxReadPatch(source), { name: 'Ana', unread: 0, channel: 'WhatsApp' });
  assert.equal(source.unread, 3, 'the original record remains unchanged');
});

test('marks a conversation read even when its old unread count is absent', () => {
  assert.deepEqual(buildInboxReadPatch({ id: 'conversation-2', text: 'Olá' }), { text: 'Olá', unread: 0 });
});
