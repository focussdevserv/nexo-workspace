import { normalizeTicketStatus } from './ticket-status.js';

export function ticketSlaDeadline(hours, now = new Date()) {
  const duration = Number(hours);
  if (![4, 8, 24, 48].includes(duration)) return null;
  return new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();
}

export function ticketSlaState(ticket, now = Date.now()) {
  if (normalizeTicketStatus(ticket.status) === 'Resolvido') return { state: 'Finalizado', remainingMs: null };
  const dueAt = Date.parse(ticket.slaDueAt || '');
  if (!Number.isFinite(dueAt)) return { state: 'Sem SLA', remainingMs: null };
  const remainingMs = dueAt - now;
  return { state: remainingMs <= 0 ? 'Vencido' : 'No prazo', remainingMs };
}

export function ticketSlaLabel(ticket, now = Date.now()) {
  const { state, remainingMs } = ticketSlaState(ticket, now);
  if (remainingMs === null) return state;
  if (state === 'Vencido') return remainingMs === 0 ? 'Vencido agora' : `Vencido ha ${Math.max(1, Math.floor(Math.abs(remainingMs) / 3_600_000))} h`;
  const hours = Math.ceil(remainingMs / 3_600_000);
  return hours < 24 ? `Restam ${hours} h` : `Restam ${Math.ceil(hours / 24)} d`;
}

export function countOverdueTickets(tickets, now = Date.now()) {
  return tickets.filter((ticket) => ticketSlaState(ticket, now).state === 'Vencido').length;
}
