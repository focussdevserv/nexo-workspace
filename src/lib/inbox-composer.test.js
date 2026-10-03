import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emptyInboxComposerDraft, inboxConversationClientId } from './inbox-composer.js';

test('a new inbox composer always starts without a previous recipient or message', () => {
  const draft = emptyInboxComposerDraft();
  assert.deepEqual(draft, { name: '', company: '', phone: '', email: '', subject: '', body: '', clientId: '' });
  draft.body = 'Edited message';
  assert.equal(emptyInboxComposerDraft().body, '');
});

test('inbox composer open and discard paths clear recipient, message, attachment and assignee state', () => {
  const source = readFileSync(fileURLToPath(new URL('../screens/ServiceScreens.jsx', import.meta.url)), 'utf8');
  assert.match(source, /const closeNewConversation = \(\) => \{ setNewOpen\(false\); setNewContact\(emptyInboxComposerDraft\(\)\); setAttachment\(null\); setOwner\(''\); setConversationError\(''\); \};/);
  assert.match(source, /const openNewConversation = \(trigger\) => \{ newDialogTriggerRef\.current = trigger \|\| null; setConversationError\(''\); setNewContact\(emptyInboxComposerDraft\(\)\); setAttachment\(null\); setOwner\(''\); setNewOpen\(true\); \};/);
  assert.match(source, /label="Nova conversa" onClick=\{\(event\) => openNewConversation\(event\.currentTarget\)\}/);
  assert.match(source, /onClick=\{closeNewConversation\}>Cancelar<\/button>/);
  assert.match(source, /event\.target === event\.currentTarget\) closeNewConversation\(\);/);
});

test('inbox composer draft can retain the CRM client identity', () => {
  assert.equal(emptyInboxComposerDraft().clientId, '');
  const clients = [
    { id: 'client-a', name: 'Aurora', email: 'same@example.com' },
    { id: 'client-b', name: 'Aurora unidade 2', email: 'same@example.com' },
  ];
  assert.equal(inboxConversationClientId({ clientId: 'client-b', email: 'same@example.com' }, clients), 'client-b');
});

test('inbox composer only infers a canonical client from a unique exact contact match', () => {
  const clients = [
    { id: 'client-a', name: 'Aurora', email: 'ana@example.com' },
    { id: 'client-b', name: 'Beta', email: 'bia@example.com' },
  ];
  assert.equal(inboxConversationClientId({ email: 'ANA@example.com' }, clients), 'client-a');
  assert.equal(inboxConversationClientId({ company: 'Aurora' }, clients), '');
  assert.equal(inboxConversationClientId({ clientId: 'stale', email: 'ana@example.com' }, clients), '');
});

test('CRM client identity is retained from navigation prefill through the inbox creation payload', () => {
  const source = readFileSync(fileURLToPath(new URL('../screens/ServiceScreens.jsx', import.meta.url)), 'utf8');
  const navigationStart = source.indexOf('if (!navigationContext.clientId || messagesLoading');
  const createStart = source.indexOf('const createConversation = async (event) =>');
  const createEnd = source.indexOf('const updateConversationMetadata = async', createStart);
  assert.ok(navigationStart >= 0 && createStart > navigationStart && createEnd > createStart);
  const navigation = source.slice(navigationStart, createStart);
  const createHandler = source.slice(createStart, createEnd);
  assert.match(navigation, /setNewContact\(\{[^}]*clientId:\s*String\(client\.id\)/);
  assert.match(createHandler, /clientId:\s*inboxConversationClientId\(newContact, clientsStore\.records, contactsStore\.records\)/);
  assert.match(createHandler, /body:\s*JSON\.stringify\(\{\s*data:\s*Object\.fromEntries\(Object\.entries\(item\)/);
});
