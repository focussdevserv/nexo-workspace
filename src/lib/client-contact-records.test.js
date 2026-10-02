import assert from 'node:assert/strict';
import test from 'node:test';
import { removeClientContact } from './client-contact-records.js';

test('removing a client contact returns a new linked client record and preserves other contacts', () => {
  const client = { id: 'client-1', name: 'Acme', contacts: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bia' }] };
  const updated = removeClientContact(client, 1);
  assert.deepEqual(updated, { ...client, contacts: [{ id: 2, name: 'Bia' }] });
  assert.equal(client.contacts.length, 2);
});

test('removing an unknown or invalid contact fails without changing the client', () => {
  const client = { id: 'client-1', contacts: [{ id: 'a', name: 'Ana' }] };
  assert.throws(() => removeClientContact(client, 'missing'), /client_contact_not_found/);
  assert.throws(() => removeClientContact(client, ''), /client_contact_invalid/);
  assert.equal(client.contacts.length, 1);
});

test('removes a selected legacy client contact without an ID by its record reference', () => {
  const legacyContact = { name: 'Ana', email: 'ana@example.com' };
  const otherContact = { name: 'Bia', email: 'bia@example.com' };
  const client = { id: 'client-1', contacts: [legacyContact, otherContact] };

  assert.deepEqual(removeClientContact(client, legacyContact), { ...client, contacts: [otherContact] });
  assert.equal(client.contacts.length, 2);
});

test('does not remove a different legacy contact when the selected object is not in the client', () => {
  const client = { id: 'client-1', contacts: [{ name: 'Ana' }] };
  assert.throws(() => removeClientContact(client, { name: 'Ana' }), /client_contact_not_found/);
});
