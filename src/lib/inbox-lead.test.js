import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncActionLock } from './async-action-lock.js';
import { buildInboxLeadDraft, canCreateInboxLead, createInboxLeadOnce } from './inbox-lead.js';

test('builds a reviewed Gmail or Hostinger lead with contact and thread origin', () => {
  const conversation = { id: 'row-1', threadId: 'thread-9', name: 'Ana', email: 'Ana@Example.com', subject: 'Orçamento' };
  const gmail = buildInboxLeadDraft({ ...conversation, provider: 'google' }, 'E-mail');
  assert.equal(gmail.email, 'Ana@Example.com');
  assert.equal(gmail.source, 'Gmail');
  assert.equal(gmail.sourceChannel, 'Gmail');
  assert.equal(gmail.sourceConversationId, 'row-1');
  assert.equal(gmail.sourceThreadId, 'thread-9');
  assert.equal(buildInboxLeadDraft({ ...conversation, provider: 'hostinger' }, 'E-mail').source, 'Hostinger');
});

test('creates WhatsApp lead with editable contact data and preserves conversation history', async () => {
  const history = [{ side: 'received', text: 'Olá', time: 'now' }];
  const conversation = { id: 'chat-1', name: 'Bia', phone: '5511999990000', whatsappChatId: '5511999990000@c.us', history };
  const draft = buildInboxLeadDraft(conversation, 'WhatsApp');
  draft.name = 'Beatriz';
  const saved = [];
  const result = await createInboxLeadOnce(createAsyncActionLock(), {
    user: { role: 'owner' }, conversation, channel: 'WhatsApp', draft,
    create: async (data) => { saved.push(data); return data; },
  });
  assert.equal(result.kind, 'created');
  assert.equal(saved[0].name, 'Beatriz');
  assert.equal(saved[0].phone, '5511999990000');
  assert.equal(saved[0].sourceChannel, 'WhatsApp');
  assert.equal(saved[0].sourceConversationId, 'chat-1');
  assert.equal(saved[0].sourceThreadId, '');
  assert.deepEqual(conversation.history, history);
});

test('treats a retried duplicate API response as neutral and never submits duplicates found locally', async () => {
  const draft = buildInboxLeadDraft({ id: 'c1', name: 'Ana', email: 'ana@example.com' }, 'E-mail');
  let creates = 0;
  const options = { user: { role: 'owner' }, channel: 'E-mail', conversation: { id: 'c1' }, draft, create: async () => { creates += 1; const error = new Error('duplicate'); error.code = 'duplicate_lead'; throw error; } };
  const lock = createAsyncActionLock();
  assert.equal((await createInboxLeadOnce(lock, options)).kind, 'duplicate');
  assert.equal((await createInboxLeadOnce(lock, { ...options, records: [{ id: 'lead-1', email: 'ANA@example.com' }] })).kind, 'duplicate');
  assert.equal(creates, 1);
});

test('requires CRM create permission and makes no request when denied', async () => {
  assert.equal(canCreateInboxLead({ role: 'member', permissions: { crm: { read: true, write: false } } }), false);
  let creates = 0;
  const result = await createInboxLeadOnce(createAsyncActionLock(), { user: { role: 'member', permissions: { crm: { read: true, write: false } } }, create: async () => { creates += 1; } });
  assert.equal(result.kind, 'denied');
  assert.equal(creates, 0);
});
