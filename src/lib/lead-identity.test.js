import test from 'node:test';
import assert from 'node:assert/strict';
import { findLeadDuplicateMatch } from './lead-identity.js';

test('lead conversion refuses to link identifiers that match different clients', () => {
  const clients = [
    { id: 'email-client', email: 'ana@example.com', phone: '(11) 91111-2222' },
    { id: 'phone-client', email: 'bia@example.com', phone: '(11) 93333-4444' },
  ];
  assert.deepEqual(findLeadDuplicateMatch(clients, { email: 'ANA@example.com', phone: '+55 11 93333-4444' }), { kind: 'ambiguous' });
});

test('lead conversion links an existing client when both identifiers match it', () => {
  const client = { id: 'client-1', email: 'ana@example.com', phone: '(11) 91111-2222' };
  assert.deepEqual(findLeadDuplicateMatch([client], { email: 'ANA@example.com', phone: '+55 11 91111-2222' }), { kind: 'match', record: client });
});
