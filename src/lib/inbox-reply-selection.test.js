import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxReplySelectionKey, shouldClearInboxReplyComposer } from './inbox-reply-selection.js';

test('reply selection is unique to its channel and conversation', () => {
  assert.equal(inboxReplySelectionKey('WhatsApp', 'conversation-1'), 'WhatsApp:conversation-1');
  assert.equal(inboxReplySelectionKey('E-mail', 'conversation-1'), 'E-mail:conversation-1');
  assert.equal(inboxReplySelectionKey('WhatsApp', ''), '');
});

test('reply draft and attachment must be cleared when switching conversations or channels', () => {
  const first = inboxReplySelectionKey('WhatsApp', 'conversation-1');
  assert.equal(shouldClearInboxReplyComposer(first, inboxReplySelectionKey('WhatsApp', 'conversation-2')), true);
  assert.equal(shouldClearInboxReplyComposer(first, inboxReplySelectionKey('E-mail', 'conversation-1')), true);
  assert.equal(shouldClearInboxReplyComposer(first, first), false);
});
