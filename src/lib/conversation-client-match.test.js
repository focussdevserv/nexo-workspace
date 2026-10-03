import test from 'node:test';
import assert from 'node:assert/strict';
import { matchConversationClient } from './conversation-client-match.js';

const clients = [
  { id: '1', name: 'Acme', email: 'financeiro@acme.com', phone: '(11) 99999-0000' },
  { id: '2', name: 'Beta', email: 'contato@beta.com', phone: '(21) 98888-0000' },
];

test('matches inbox contact by exact email or Brazilian phone number', () => {
  assert.equal(matchConversationClient(clients, [], { email: 'Financeiro@Acme.com' })?.id, '1');
  assert.equal(matchConversationClient(clients, [], { phone: '+55 11 99999-0000' })?.id, '1');
});

test('matches contacts through their canonical client link', () => {
  assert.equal(matchConversationClient(clients, [{ clientId: '2', email: 'outro@beta.com' }], { email: 'outro@beta.com' })?.id, '2');
});

test('prefers a conversation canonical client ID over ambiguous contact details', () => {
  const anotherAcmeContact = { id: '3', name: 'Acme branch', email: 'financeiro@acme.com', phone: '(11) 99999-0000' };
  assert.equal(matchConversationClient([...clients, anotherAcmeContact], [], {
    clientId: '2', email: 'financeiro@acme.com', phone: '(11) 99999-0000',
  })?.id, '2');
});

test('rejects stale or conflicting explicit conversation client IDs without guessing by email', () => {
  assert.equal(matchConversationClient(clients, [], { clientId: 'deleted', email: 'financeiro@acme.com' }), null);
  assert.equal(matchConversationClient(clients, [], { clientId: '1', clientRecordId: '2', email: 'financeiro@acme.com' }), null);
});

test('refuses ambiguous or name-only conversation matches', () => {
  assert.equal(matchConversationClient([...clients, { id: '3', email: 'financeiro@acme.com' }], [], { email: 'financeiro@acme.com' }), null);
  assert.equal(matchConversationClient(clients, [], { name: 'Acme', company: 'Acme' }), null);
});
