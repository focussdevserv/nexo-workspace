import { ticketSlaState } from './ticket-sla.js';
import { normalizeTicketStatus } from './ticket-status.js';

export const ticketQueueFilters = [
  'Todos',
  'Aberto',
  'Em andamento',
  'Aguardando cliente',
  'Resolvido',
  'Fora do SLA',
];
const knownStatuses = new Set(ticketQueueFilters.slice(1, 5));

export function filterSupportTickets(tickets, filter = 'Todos', now = Date.now()) {
  if (!Array.isArray(tickets)) return [];
  if (filter === 'Todos') return tickets;
  if (filter === 'Fora do SLA') {
    return tickets.filter((ticket) => ticketSlaState(ticket, now).state === 'Vencido');
  }
  const normalizedFilter = normalizeTicketStatus(filter);
  if (!knownStatuses.has(normalizedFilter)) return tickets;
  return tickets.filter((ticket) => normalizeTicketStatus(ticket.status) === normalizedFilter);
}
