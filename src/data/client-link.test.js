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
