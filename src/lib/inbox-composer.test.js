import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { emptyInboxComposerDraft } from './inbox-composer.js';

test('a new inbox composer always starts without a previous recipient or message', () => {
  const draft = emptyInboxComposerDraft();
  assert.deepEqual(draft, { name: '', company: '', phone: '', email: '', subject: '', body: '' });
  draft.body = 'Edited message';
  assert.equal(emptyInboxComposerDraft().body, '');
});

test('inbox composer open and discard paths clear recipient, message, attachment and assignee state', () => {
  const source = readFileSync(fileURLToPath(new URL('../screens/ServiceScreens.jsx', import.meta.url)), 'utf8');
  assert.match(source, /const closeNewConversation = \(\) => \{ setNewOpen\(false\); setNewContact\(emptyInboxComposerDraft\(\)\); setAttachment\(null\); setOwner\(''\); setConversationError\(''\); \};/);
  assert.match(source, /label="Nova conversa" onClick=\{\(\) => \{ setConversationError\(''\); setNewContact\(emptyInboxComposerDraft\(\)\); setAttachment\(null\); setOwner\(''\); setNewOpen\(true\); \}\}/);
  assert.match(source, /onClick=\{closeNewConversation\}>Cancelar<\/button>/);
  assert.match(source, /event\.target === event\.currentTarget\) closeNewConversation\(\);/);
});
