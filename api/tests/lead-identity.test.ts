import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateLead, normalizeLeadPhone } from '../src/crm/lead-identity.js';

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
