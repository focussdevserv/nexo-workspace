import assert from 'node:assert/strict';
import test from 'node:test';
import { presentClientContact } from './client-contact-presentation.js';

test('projects malformed legacy contact fields to safe display strings without changing the source', () => {
  const legacy = { id: 'old-1', name: { first: 'Ana' }, role: null, email: ['ana@example.test'], phone: 11999999999 };
  assert.deepEqual(presentClientContact(legacy, 2), {
    key: 'old-1', name: 'Contato sem nome', initials: 'Cs', role: 'Contato', email: '', phone: '11999999999',
  });
  assert.deepEqual(legacy, { id: 'old-1', name: { first: 'Ana' }, role: null, email: ['ana@example.test'], phone: 11999999999 });
});

test('provides stable fallback labels and keys for incomplete legacy rows', () => {
  assert.deepEqual(presentClientContact({}, 4), {
    key: 'legacy-contact-4', name: 'Contato sem nome', initials: 'Cs', role: 'Contato', email: '', phone: '',
  });
});
