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
  if (state === 'Vencido') {
    if (remainingMs === 0) return 'Vencido agora';
    const overdueMinutes = Math.floor(Math.abs(remainingMs) / 60_000);
    if (overdueMinutes < 60) return overdueMinutes === 0 ? 'Vencido há menos de 1 min' : `Vencido há ${overdueMinutes} min`;
    return `Vencido há ${Math.floor(overdueMinutes / 60)} h`;
  }
  if (remainingMs < 3_600_000) {
    const remainingMinutes = Math.ceil(remainingMs / 60_000);
    return remainingMinutes < 60 ? `Restam ${remainingMinutes} min` : 'Restam 1 h';
  }
  const hours = Math.ceil(remainingMs / 3_600_000);
  return hours < 24 ? `Restam ${hours} h` : `Restam ${Math.ceil(hours / 24)} d`;
}

export function countOverdueTickets(tickets, now = Date.now()) {
  return tickets.filter((ticket) => ticketSlaState(ticket, now).state === 'Vencido').length;
}
