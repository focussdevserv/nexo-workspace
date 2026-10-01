import test from 'node:test';
import assert from 'node:assert/strict';
import { ticketSlaDeadline, ticketSlaLabel, ticketSlaState } from './ticket-sla.js';

test('computes an explicitly selected ticket SLA deadline', () => {
  const now = new Date('2026-10-01T09:00:00.000Z');
  assert.equal(ticketSlaDeadline(8, now), '2026-10-01T17:00:00.000Z');
  assert.equal(ticketSlaDeadline('sem prazo', now), null);
});

test('reports overdue, remaining, missing and completed SLA states', () => {
  const now = Date.parse('2026-10-01T09:00:00.000Z');
  assert.equal(ticketSlaState({ status: 'Aberto', slaDueAt: '2026-10-01T08:00:00Z' }, now).state, 'Vencido');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: '2026-10-01T12:00:00Z' }, now), 'Restam 3 h');
  assert.equal(ticketSlaState({ status: 'Aberto' }, now).state, 'Sem SLA');
  assert.equal(ticketSlaState({ status: 'Resolvido', slaDueAt: '2026-10-01T08:00:00Z' }, now).state, 'Finalizado');
});
