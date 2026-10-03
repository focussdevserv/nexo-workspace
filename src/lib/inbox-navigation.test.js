import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInboxChannel, resolveInboxConversationNavigation } from './inbox-navigation.js';

test('normalizes supported email and WhatsApp channel names', () => {
  assert.equal(normalizeInboxChannel('Gmail'), 'E-mail');
  assert.equal(normalizeInboxChannel(' Hostinger E-mail '), 'E-mail');
  assert.equal(normalizeInboxChannel('waha'), 'WhatsApp');
  assert.equal(normalizeInboxChannel('other'), '');
});

test('waits for the requested channel and its data before resolving a conversation', () => {
  const context = { conversationId: 'thread-4', channel: 'Gmail' };

  assert.deepEqual(resolveInboxConversationNavigation(context, [], 'WhatsApp', false), { status: 'pending', channel: 'E-mail' });
  assert.deepEqual(resolveInboxConversationNavigation(context, [], 'E-mail', true), { status: 'pending', channel: 'E-mail' });
});

test('matches the exact inbox id, provider conversation id, or email thread id', () => {
  const conversations = [
    { id: 'whatsapp-1', channel: 'WhatsApp' },
    { id: 'email-1', threadId: 'thread-4', channel: 'Gmail' },
  ];

  assert.deepEqual(resolveInboxConversationNavigation({ conversationId: 'thread-4', channel: 'E-mail' }, conversations, 'E-mail', false), {
    status: 'found', channel: 'E-mail', conversation: conversations[1],
  });
  assert.deepEqual(resolveInboxConversationNavigation({ conversationId: 'whatsapp-1', channel: 'WhatsApp' }, conversations, 'WhatsApp', false), {
    status: 'found', channel: 'WhatsApp', conversation: conversations[0],
  });
});

test('reports not found only after the target channel finished loading', () => {
  assert.deepEqual(resolveInboxConversationNavigation({ conversationId: 'missing', channel: 'Gmail' }, [], 'E-mail', false), {
    status: 'not_found', channel: 'E-mail',
  });
});
