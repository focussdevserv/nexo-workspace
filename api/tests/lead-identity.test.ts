import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateLead, findLeadDuplicateMatch, normalizeLeadPhone } from '../src/crm/lead-identity.js';

test('normalizes phone numbers while preserving only digits', () => {
  assert.equal(normalizeLeadPhone('+55 (11) 98888-7777'), '11988887777');
});

test('finds duplicate leads by case-insensitive email or normalized phone', () => {
  const leads = [{ id: 'a', email: ' Pessoa@Exemplo.com ', phone: '(11) 98888-7777' }];
  assert.equal(findDuplicateLead(leads, { email: 'pessoa@exemplo.com' })?.id, 'a');
  assert.equal(findDuplicateLead(leads, { phone: '+55 11 98888-7777' })?.id, 'a');
});

test('does not match leads without identifying contact data', () => {
  assert.equal(findDuplicateLead([{ id: 'a', email: '', phone: '' }], {}), undefined);
});

test('flags conversion when email and phone identify different existing clients', () => {
  const clients = [
    { id: 'client-email', email: 'ana@example.com', phone: '11911112222' },
    { id: 'client-phone', email: 'bia@example.com', phone: '11933334444' },
  ];
  assert.deepEqual(findLeadDuplicateMatch(clients, { email: 'ana@example.com', phone: '+55 11 93333-4444' }), { kind: 'ambiguous' });
});

test('returns the same client when email and phone both match it', () => {
  const client = { id: 'client-1', email: 'ana@example.com', phone: '11911112222' };
  assert.deepEqual(findLeadDuplicateMatch([client], { email: 'ANA@example.com', phone: '+55 11 91111-2222' }), { kind: 'match', record: client });
});
