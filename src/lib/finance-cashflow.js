import { isFinanceReceivableStatusOpen } from './finance-receivable-status.js';
import { formatWorkspaceCurrency } from './workspace-formatting.js';

const settledStatuses = new Set(['recebida', 'recebido', 'paga', 'pago', 'settled', 'paid', 'received']);
const cancelledStatuses = new Set(['cancelada', 'cancelado', 'cancelled', 'canceled', 'estornada', 'refunded']);
const pendingStatuses = new Set(['pendente', 'pending', 'aberta', 'open']);

export function isFinanceRecordOverdue(record, today = new Date()) {
  const status = String(record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const dueDate = String(record.dueDate || '').slice(0, 10);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return pendingStatuses.has(status) && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < todayKey;
}

export function isFinanceReceivableOpen(record) {
  return isFinanceReceivableStatusOpen(record?.status);
}

// Workspace IDs are the stable identity for actions. Display codes can be duplicated
// in older/manual records, so never use a code as the primary edit/delete key.
export function financeRecordActionKey(record) {
  return record?.id ?? record?.code ?? '';
}

export function filterFinanceRecords(records, { category = 'Todos', period = 'Todos', clientId = 'Todos', today = new Date() } = {}) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonthStart = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`;
  const prevMonthStart = month === 0 ? `${year - 1}-12-01` : `${year}-${String(month).padStart(2, '0')}-01`;
  return records.filter((record) => {
    if (category !== 'Todos' && String(record.category || 'Sem categoria') !== category) return false;
    if (clientId !== 'Todos' && String(record.clientId || record.workspaceClientId || record.clientRecordId || '') !== String(clientId)) return false;
    if (period === 'Todos') return true;
    const date = String(record.dueDate || record.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    if (period === 'Este mês') return date >= monthStart && date < nextMonthStart;
    if (period === 'Mês passado') return date >= prevMonthStart && date < monthStart;
    if (period === 'Este ano') return date >= `${year}-01-01` && date < `${year + 1}-01-01`;
    return true;
  });
}

export function financeRecordsCsv(records, kind = 'receitas') {
  const counterpartLabel = kind === 'despesas' ? 'Fornecedor' : 'Cliente';
  const rows = [[kind === 'despesas' ? 'Despesa' : 'Receita', counterpartLabel, 'Categoria', 'Data', 'Vencimento', 'Valor', 'Status'], ...records.map((record) => [
    record.description || '', record.counterparty || '', record.category || '', record.date || '', record.dueDate || '', record.amount ?? '', record.status || 'Pendente',
  ])];
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}`;
}

function asLocalDate(value) {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text);
}

export function sortFinanceActivity(records, limit = 8) {
  return [...records].sort((left, right) => {
    const leftDate = asLocalDate(left.date).getTime();
    const rightDate = asLocalDate(right.date).getTime();
    const leftTime = Number.isFinite(leftDate) ? leftDate : -Infinity;
    const rightTime = Number.isFinite(rightDate) ? rightDate : -Infinity;
    return leftTime === rightTime ? 0 : rightTime - leftTime;
  }).slice(0, Math.max(0, limit));
}

export function financeOverviewActivityRows(incomeRows, expenseRows, limit = 8, preferences = {}) {
  return sortFinanceActivity([
    ...incomeRows.map((row) => ({ ...row, entryType: 'income' })),
    ...expenseRows.map((row) => ({ ...row, entryType: 'expense' })),
  ], limit).map((row) => [
    row.description || row.code || row.id || '',
    row.counterparty || row.category || '',
    row.date || '',
    `${row.entryType === 'income' ? '+' : '-'} ${formatWorkspaceCurrency(Number(row.amount) || 0, preferences)}`,
    row.status || 'Pendente',
  ]);
}

function sumMonth(rows, month, realized, currentMonth) {
  return rows.filter((row) => {
    const status = String(row.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (cancelledStatuses.has(status) || settledStatuses.has(status) !== realized) return false;
    // Failed/expired/rejected payments are not future cash, even though they
    // are neither settled nor cancelled. Keep open and overdue receivables in
    // the forecast until they are paid or explicitly closed.
    if (!realized && !isFinanceReceivableOpen(row)) return false;
    const date = asLocalDate(realized ? row.settledAt || row.date : row.dueDate || row.date);
    if (Number.isNaN(date.valueOf())) return false;
    if (!realized && date < currentMonth) date.setTime(currentMonth.getTime());
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

export function buildCashflowMonths(incomeRows, expenseRows, now = new Date()) {
  const currentMonth = new Date(now);
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  return Array.from({ length: 6 }, (_, index) => {
    const month = new Date(currentMonth);
    month.setMonth(month.getMonth() - 3 + index);
    return {
      month,
      incomeRealized: sumMonth(incomeRows, month, true, currentMonth),
      incomeForecast: sumMonth(incomeRows, month, false, currentMonth),
      expenseRealized: sumMonth(expenseRows, month, true, currentMonth),
      expenseForecast: sumMonth(expenseRows, month, false, currentMonth),
    };
  });
}
