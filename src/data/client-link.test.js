import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToClient, clientTicketPresentation } from './client-link.js';

test('maps workspace ticket objects into readable client profile rows', () => {
  const ticket = clientTicketPresentation({ id: '1', code: 'NX-1', title: 'Erro na loja', status: 'Resolvido', updatedAt: '2026-10-01T10:00:00.000Z' });
  assert.deepEqual(ticket, { id: '1', code: 'NX-1', title: 'Erro na loja', status: 'Resolvido', updatedAt: '2026-10-01T10:00:00.000Z', tone: 'green' });
});

test('ticket links use client ID and do not leak to a homonymous client', () => {
  const ticket = { clientId: 'client-one', client: 'Acme' };
  assert.equal(belongsToClient(ticket, { id: 'client-one', name: 'Acme' }, ticket.client), true);
  assert.equal(belongsToClient(ticket, { id: 'client-two', name: 'Acme' }, ticket.client), false);
});

test('client profile recognizes all persisted client link fields', () => {
  const client = { id: 'client-a', name: 'Acme' };
  for (const field of ['workspaceClientId', 'clientId', 'clientRecordId']) {
    assert.equal(belongsToClient({ [field]: 'client-a', client: 'Different name' }, client), true, field);
    assert.equal(belongsToClient({ [field]: 'client-b', client: 'Acme' }, client), false, field);
  }
});

test('conflicting client link IDs never fall back to a matching name', () => {
  assert.equal(belongsToClient({ clientId: 'client-a', clientRecordId: 'client-b', client: 'Acme' }, { id: 'client-a', name: 'Acme' }), false);
});
