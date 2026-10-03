import test from 'node:test';
import assert from 'node:assert/strict';
import { countOverdueTickets, ticketSlaDeadline, ticketSlaForReopen, ticketSlaLabel, ticketSlaReopenNotice, ticketSlaState } from './ticket-sla.js';

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

test('overdue count updates as an open ticket crosses its deadline', () => {
  const ticket = { status: 'Em andamento', slaDueAt: '2026-10-01T09:01:00.000Z' };
  assert.equal(countOverdueTickets([ticket], Date.parse('2026-10-01T09:00:00.000Z')), 0);
  assert.equal(countOverdueTickets([ticket], Date.parse('2026-10-01T09:01:01.000Z')), 1);
  assert.equal(countOverdueTickets([{ ...ticket, status: 'Resolvido' }], Date.parse('2026-10-01T10:00:00.000Z')), 0);
});

test('resolved tickets using supported English status aliases are excluded from overdue SLA', () => {
  const now = Date.parse('2026-10-01T10:00:00.000Z');
  const pastDue = '2026-10-01T09:00:00.000Z';

  for (const status of ['resolved', 'done', 'closed']) {
    assert.deepEqual(ticketSlaState({ status, slaDueAt: pastDue }, now), { state: 'Finalizado', remainingMs: null });
  }
  assert.equal(countOverdueTickets(['resolved', 'done', 'closed'].map((status) => ({ status, slaDueAt: pastDue })), now), 0);
});

test('a ticket becomes overdue at the exact SLA deadline', () => {
  const now = Date.parse('2026-10-01T09:00:00.000Z');
  const ticket = { status: 'Aberto', slaDueAt: '2026-10-01T09:00:00.000Z' };
  assert.equal(ticketSlaState(ticket, now).state, 'Vencido');
  assert.equal(ticketSlaLabel(ticket, now), 'Vencido agora');
  assert.equal(countOverdueTickets([ticket], now), 1);
});

test('ticket SLA labels show accurate minute-level timing around the one-hour boundary', () => {
  const now = Date.parse('2026-10-01T10:00:00.000Z');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now + 30 * 60_000).toISOString() }, now), 'Restam 30 min');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now - 30 * 60_000).toISOString() }, now), 'Vencido há 30 min');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now - 1_000).toISOString() }, now), 'Vencido há menos de 1 min');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now + 59 * 60_000 + 30_000).toISOString() }, now), 'Restam 1 h');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now - 60 * 60_000).toISOString() }, now), 'Vencido há 1 h');
  assert.equal(ticketSlaLabel({ status: 'Aberto', slaDueAt: new Date(now + 60 * 60_000).toISOString() }, now), 'Restam 1 h');
});

test('reopening a resolved ticket starts a fresh deadline and preserves the old SLA history', () => {
  const now = new Date('2026-10-03T12:00:00.000Z');
  const previousDueAt = '2026-10-01T17:00:00.000Z';
  const priorHistory = [{ type: 'reopened', previousDueAt: '2026-09-20T17:00:00.000Z', renewedAt: '2026-09-25T12:00:00.000Z' }];
  const ticket = { status: 'Resolvido', slaHours: 8, slaDueAt: previousDueAt, slaHistory: priorHistory, createdAt: '2026-10-01T09:00:00.000Z' };
  const patch = ticketSlaForReopen(ticket, now);
  assert.equal(patch.slaDueAt, '2026-10-03T20:00:00.000Z');
  assert.equal(patch.slaHours, 8);
  assert.equal(patch.originalSlaDueAt, previousDueAt);
  assert.equal(patch.slaHistory.length, 2);
  assert.equal(patch.slaHistory[0], priorHistory[0]);
  assert.deepEqual(patch.slaHistory[1], { type: 'reopened', previousDueAt, renewedAt: now.toISOString() });
  assert.match(ticketSlaReopenNotice(ticket, now), /8 horas.*prazo anterior.*histórico/i);
});

test('legacy ticket reopening infers its duration and uses a safe 24-hour fallback when needed', () => {
  const now = new Date('2026-10-03T12:00:00.000Z');
  const inferred = ticketSlaForReopen({ status: 'Resolvido', createdAt: '2026-10-01T09:00:00Z', slaDueAt: '2026-10-01T17:00:00Z' }, now);
  assert.equal(inferred.slaHours, 8);
  assert.equal(inferred.slaDueAt, '2026-10-03T20:00:00.000Z');
  const fallback = ticketSlaForReopen({ status: 'Resolvido', slaDueAt: '2026-10-01T17:00:00Z' }, now);
  assert.equal(fallback.slaHours, 24);
  assert.equal(fallback.slaDueAt, '2026-10-04T12:00:00.000Z');
});

test('reopening a ticket explicitly configured without SLA keeps it without SLA and shows that clearly', () => {
  const now = new Date('2026-10-03T12:00:00.000Z');
  const ticket = { status: 'Resolvido', slaHours: null, slaDueAt: null };
  assert.deepEqual(ticketSlaForReopen(ticket, now), { slaHours: null, slaDueAt: null, originalSlaDueAt: null, slaHistory: [] });
  assert.match(ticketSlaReopenNotice(ticket, now), /continuará sem prazo/i);
});
