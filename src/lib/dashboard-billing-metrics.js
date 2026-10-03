import { calendarDateKeyForValue } from './calendar-preferences.js';

const terminalOrderStatuses = new Set([
  'paid', 'paga', 'pago', 'recebida', 'recebido', 'approved', 'processed',
  'cancelled', 'canceled', 'cancelada', 'refunded', 'estornada', 'failed',
  'falhou', 'rejected', 'recusada', 'expired', 'expirada',
]);

function normalizedStatus(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function isReceivable(item) {
  const status = normalizedStatus(item?.status);
  if (item?.billingKind === 'subscription') return status === 'authorized' || status === 'autorizada';
  return !terminalOrderStatuses.has(status);
}

function dueDate(item, timeZone) {
  return calendarDateKeyForValue(
    item?.dueAt || item?.dueDate || item?.due || item?.nextPaymentAt || item?.nextDue || item?.startAt,
    timeZone,
  );
}

function amount(item) {
  const value = Number(item?.amount ?? item?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function dashboardBillingMetrics(items = [], { today, through, timeZone = 'America/Sao_Paulo' } = {}) {
  const bills = Array.isArray(items) ? items.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : [];
  const receivables = bills.filter(isReceivable);
  const overdueBills = receivables.filter((item) => {
    const due = dueDate(item, timeZone);
    return (due && due < today) || ['overdue', 'atrasada', 'vencida'].includes(normalizedStatus(item.status));
  });
  const upcomingAmount = receivables.reduce((sum, item) => {
    const due = dueDate(item, timeZone);
    return due && due >= today && due <= through ? sum + amount(item) : sum;
  }, 0);

  return { overdueBills, upcomingAmount };
}
