import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSupportTickets, ticketQueueFilters } from './ticket-filter.js';

const now = Date.parse('2026-10-02T12:00:00.000Z');
const tickets = [
  { id: 'open', status: 'Aberto', slaDueAt: '2026-10-02T13:00:00.000Z' },
  { id: 'legacy-open', status: 'OPEN', slaDueAt: '2026-10-02T11:00:00.000Z' },
  { id: 'waiting', status: 'Aguardando cliente', slaDueAt: '2026-10-02T10:00:00.000Z' },
  { id: 'resolved', status: 'Resolvido', slaDueAt: '2026-10-02T10:00:00.000Z' },
];

test('ticket queue filters include all expected operational views', () => {
  assert.deepEqual(ticketQueueFilters, ['Todos', 'Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido', 'Fora do SLA']);
});

test('status filters recognize legacy status values', () => {
  assert.deepEqual(filterSupportTickets(tickets, 'Aberto', now).map(({ id }) => id), ['open', 'legacy-open']);
  assert.deepEqual(filterSupportTickets(tickets, 'Aguardando cliente', now).map(({ id }) => id), ['waiting']);
});

test('overdue filter excludes resolved tickets even when their old SLA date passed', () => {
  assert.deepEqual(filterSupportTickets(tickets, 'Fora do SLA', now).map(({ id }) => id), ['legacy-open', 'waiting']);
});

test('unknown filter and non-array input fail safely', () => {
  assert.deepEqual(filterSupportTickets(tickets, 'unknown', now), tickets);
  assert.deepEqual(filterSupportTickets(null, 'Todos', now), []);
});
