import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTicketPriority, ticketPriorityLabel } from './ticket-priority.js';

test('normalizes legacy and accented medium-priority values for ticket editing', () => {
  for (const value of ['Normal', 'Média', 'Media', 'moderada']) {
    assert.equal(normalizeTicketPriority(value), 'Media');
    assert.equal(ticketPriorityLabel(value), 'Média');
  }
});

test('preserves supported ticket priorities and falls back for unknown legacy values', () => {
  for (const value of ['Baixa', 'Alta', 'Urgente']) {
    assert.equal(normalizeTicketPriority(value), value);
    assert.equal(ticketPriorityLabel(value), value);
  }
  assert.equal(normalizeTicketPriority(''), 'Media');
  assert.equal(normalizeTicketPriority('Crítica antiga'), 'Media');
});
