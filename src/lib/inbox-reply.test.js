import test from 'node:test';
import assert from 'node:assert/strict';
import { canReplyToInboxConversation, isResolvedInboxConversation, nextInboxConversationStatus } from './inbox-reply.js';

test('resolved WhatsApp conversations require reopening before a reply', () => {
  const conversation = { status: 'closed' };
  assert.equal(isResolvedInboxConversation(conversation), true);
  assert.equal(canReplyToInboxConversation('WhatsApp', conversation), false);
  assert.equal(canReplyToInboxConversation('WhatsApp', { status: 'open' }), true);
});

test('Portuguese resolved labels are recognized and missing status remains replyable', () => {
  assert.equal(isResolvedInboxConversation({ status: 'Resolvida' }), true);
  assert.equal(canReplyToInboxConversation('WhatsApp', null), true);
});

test('email replies remain available when a workspace status label is resolved', () => {
  assert.equal(canReplyToInboxConversation('E-mail', { status: 'closed' }), true);
});

test('reopen action handles every status variant recognized as resolved', () => {
  for (const status of ['closed', 'resolved', 'Resolvido', 'RESOLVIDA']) {
    assert.equal(nextInboxConversationStatus({ status }), 'open');
  }
  assert.equal(nextInboxConversationStatus({ status: 'open' }), 'closed');
});
