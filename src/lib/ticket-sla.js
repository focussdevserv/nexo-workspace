import { normalizeTicketStatus } from './ticket-status.js';

export function ticketSlaDeadline(hours, now = new Date()) {
  const duration = Number(hours);
  if (![4, 8, 24, 48].includes(duration)) return null;
  return new Date(now.getTime() + duration * 60 * 60 * 1000).toISOString();
}

export function ticketSlaForReopen(ticket, now = new Date()) {
  if (normalizeTicketStatus(ticket.status) !== 'Resolvido') return {};
  const existingDueAt = ticket.slaDueAt || null;
  const history = Array.isArray(ticket.slaHistory) ? ticket.slaHistory : [];
  const hasConfiguredDuration = Object.prototype.hasOwnProperty.call(ticket, 'slaHours');
  let hours = [4, 8, 24, 48].includes(Number(ticket.slaHours)) ? Number(ticket.slaHours) : null;
  if (!hours && !(hasConfiguredDuration && (ticket.slaHours === '' || ticket.slaHours === null || Number(ticket.slaHours) === 0))) {
    const createdAt = Date.parse(ticket.createdAt || '');
    const dueAt = Date.parse(existingDueAt || '');
    const inferredHours = Number.isFinite(createdAt) && Number.isFinite(dueAt)
      ? Math.round((dueAt - createdAt) / 3_600_000)
      : NaN;
    hours = [4, 8, 24, 48].includes(inferredHours) ? inferredHours : existingDueAt ? 24 : null;
  }
  if (!existingDueAt && !hasConfiguredDuration) return {};

  const reopenedAt = now.toISOString();
  return {
    slaHours: hours,
    slaDueAt: hours ? ticketSlaDeadline(hours, now) : null,
    originalSlaDueAt: ticket.originalSlaDueAt || existingDueAt,
    slaHistory: existingDueAt
      ? [...history, { type: 'reopened', previousDueAt: existingDueAt, renewedAt: reopenedAt }].slice(-100)
      : history,
  };
}

export function ticketSlaReopenNotice(ticket, now = new Date()) {
  if (normalizeTicketStatus(ticket.status) !== 'Resolvido') return '';
  const patch = ticketSlaForReopen(ticket, now);
  if (!patch.slaDueAt) return 'Este ticket não tem prazo de SLA definido; ele continuará sem prazo ao ser reaberto.';
  const oldDeadline = ticket.slaDueAt ? new Date(ticket.slaDueAt).toLocaleString('pt-BR') : '';
  const preserved = oldDeadline ? ` O prazo anterior (${oldDeadline}) ficará preservado no histórico.` : '';
  return `Ao reabrir, o SLA será reiniciado para ${patch.slaHours} horas a partir de agora.${preserved}`;
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
