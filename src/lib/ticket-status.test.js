import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTicketStatus, ticketStatusOptions } from './ticket-status.js';

test('normalizes common status casing, accents and legacy aliases', () => {
  assert.equal(normalizeTicketStatus(' ABERTO '), 'Aberto');
  assert.equal(normalizeTicketStatus('EM ANDAMENTO'), 'Em andamento');
  assert.equal(normalizeTicketStatus('Aguardando o cliente'), 'Aguardando cliente');
  assert.equal(normalizeTicketStatus('closed'), 'Resolvido');
  assert.equal(normalizeTicketStatus('Status legado'), 'Status legado');
});

test('keeps unknown statuses visible while providing canonical edit choices', () => {
  assert.deepEqual(ticketStatusOptions('custom-state'), ['custom-state', 'Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido']);
  assert.deepEqual(ticketStatusOptions('ABERTO'), ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido']);
});
