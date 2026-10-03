import { formatWorkspaceDate } from './workspace-formatting.js';
import { calendarDateKeyForValue, calendarDateInTimeZone, normalizeCalendarTimeZone } from './calendar-preferences.js';
const reportDateValue = (item, field = 'default') => {
  const candidates = field === 'created' ? [item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
    : field === 'expense' ? [item.date, item.createdAt, item.created_at, item.updatedAt, item.updated_at]
    : field === 'paid' ? [item.settledAt, item.settled_at, item.paymentDetails?.settledAt, item.paymentDetails?.settled_at, item.paidAt, item.paid_at, item.paymentDetails?.paidAt, item.paymentDetails?.paid_at, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
      : field === 'revenue-paid' ? [item.settledAt, item.settled_at, item.paymentDetails?.settledAt, item.paymentDetails?.settled_at, item.paidAt, item.paid_at, item.paymentDetails?.paidAt, item.paymentDetails?.paid_at, item.date, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
      : field === 'completed' ? [item.completedAt, item.completed_at, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
        : field === 'work' ? [item.startedAt, item.started_at, item.endedAt, item.ended_at, item.createdAt, item.created_at, item.date]
          : field === 'task' ? [item.due, item.dueAt, item.due_at, item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
            : [item.date, item.createdAt, item.created_at, item.paidAt, item.paid_at, item.updatedAt, item.updated_at, item.dueAt, item.due_at];
  return candidates.find((candidate) => candidate !== null && candidate !== undefined && candidate !== '');
};
export const dateOf = (item, field = 'default') => {
  const candidates = field === 'created' ? [item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
    : field === 'expense' ? [item.date, item.createdAt, item.created_at, item.updatedAt, item.updated_at]
    : field === 'paid' ? [item.settledAt, item.settled_at, item.paymentDetails?.settledAt, item.paymentDetails?.settled_at, item.paidAt, item.paid_at, item.paymentDetails?.paidAt, item.paymentDetails?.paid_at, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
      : field === 'revenue-paid' ? [item.settledAt, item.settled_at, item.paymentDetails?.settledAt, item.paymentDetails?.settled_at, item.paidAt, item.paid_at, item.paymentDetails?.paidAt, item.paymentDetails?.paid_at, item.date, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
      : field === 'completed' ? [item.completedAt, item.completed_at, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
          : field === 'work' ? [item.startedAt, item.started_at, item.endedAt, item.ended_at, item.createdAt, item.created_at, item.date]
            : field === 'task' ? [item.due, item.dueAt, item.due_at, item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
            : [item.date, item.createdAt, item.created_at, item.paidAt, item.paid_at, item.updatedAt, item.updated_at, item.dueAt, item.due_at];
  const value = candidates.find((candidate) => candidate !== null && candidate !== undefined && candidate !== '');
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return value === undefined ? new Date(Number.NaN) : new Date(value);
};

const reportDateKey = (value, timeZone) => calendarDateKeyForValue(value, timeZone);
const dateKeyFromCalendarDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const reportTimeZone = (preferences = {}) => normalizeCalendarTimeZone(preferences.timeZone || preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

export const periodStart = (periodId, now = new Date(), preferences = {}) => {
  const today = calendarDateInTimeZone(now, reportTimeZone(preferences));
  return periodId === 'year'
    ? new Date(today.getFullYear(), 0, 1)
    : periodId === 'quarter'
      ? new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89)
      : new Date(today.getFullYear(), today.getMonth(), 1);
};

export const inPeriod = (item, periodId, now = new Date(), field = 'default', preferences = {}) => {
  const value = reportDateValue(item, field);
  const zone = reportTimeZone(preferences);
  const key = reportDateKey(value, zone);
  if (!key) return false;
  return key >= dateKeyFromCalendarDate(periodStart(periodId, now, preferences))
    && key <= dateKeyFromCalendarDate(calendarDateInTimeZone(now, zone));
};

const normalizedStatus = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const paidReportStatuses = new Set(['paid', 'processed', 'approved', 'paga', 'pago', 'recebida', 'received', 'conciliada', 'conciliado']);
const isPaidReportRecord = (item) => paidReportStatuses.has(normalizedStatus(item.status));

// Billing providers and imported financial records use several equivalent
// paid states. Keep report totals, rows, and charts on the same status rules.
export function paidReportPayments(records = [], periodId, now = new Date(), preferences = {}) {
  return records.filter((item) => isPaidReportRecord(item) && inPeriod(item, periodId, now, 'paid', preferences));
}

// Manual receipts belong to the period in which they were settled, not the
// period when the revenue row was first created or its original due date.
export function paidReportRevenues(records = [], periodId, now = new Date(), preferences = {}) {
  return records.filter((item) => isPaidReportRecord(item) && inPeriod(item, periodId, now, 'revenue-paid', preferences));
}

// A received revenue belongs to the period in which it was settled. Open and
// other non-paid entries remain grouped by their accounting date.
export function revenueRecordsForReport(records = [], periodId, now = new Date(), preferences = {}) {
  return records.filter((item) => isPaidReportRecord(item)
    ? inPeriod(item, periodId, now, 'revenue-paid', preferences)
    : inPeriod(item, periodId, now, 'expense', preferences));
}

export function reportRevenueDate(item = {}) {
  return isPaidReportRecord(item)
    ? dateOf(item, 'revenue-paid')
    : dateOf(item, 'expense');
}

export const reportSourceState = (source, restrictedSources = [], failedSources = []) =>
  restrictedSources.includes(source) ? 'restricted' : failedSources.includes(source) ? 'failed' : 'ready';

export function reportSourcesForTab(tab) {
  if (tab === 'Comercial') return ['leads', 'orders', 'revenues'];
  if (tab === 'Projetos') return ['projects', 'tasks', 'hours'];
  if (tab === 'Financeiro') return ['orders', 'revenues', 'expenses'];
  return ['leads', 'projects', 'expenses', 'orders', 'revenues'];
}

export function hasReportSourceFailures(tab, failedSources = []) {
  return reportSourcesForTab(tab).some((source) => failedSources.includes(source));
}

// Do not produce a CSV that looks complete when one of its contributing
// modules could not be read for this user. Failures and permission denials
// both make the active report partial; unrelated sources do not.
export function canExportReport(tab, restrictedSources = [], failedSources = []) {
  const sources = reportSourcesForTab(tab);
  return !sources.some((source) => restrictedSources.includes(source) || failedSources.includes(source));
}

export function hasReportChartFailures(tab, failedSources = []) {
  const sources = tab === 'Projetos'
    ? ['projects']
    : tab === 'Comercial'
      ? ['leads']
      : ['orders', 'revenues'];
  return sources.some((source) => failedSources.includes(source));
}

export function parseReportAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const input = String(value ?? '').trim();
  if (!input) return 0;
  const parenthesizedNegative = /^\(.*\)$/.test(input);
  const raw = input.replace(/[()\s\p{Sc}]/gu, '').replace(/[^\d,.-]/g, '');
  if (!raw || !/^-?[\d.,]+$/.test(raw)) return 0;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let normalized;
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = raw.split(thousandsSeparator).join('').replace(decimalSeparator, '.');
  } else if (comma >= 0) {
    normalized = normalizeSingleCurrencySeparator(raw, ',');
  } else {
    normalized = normalizeSingleCurrencySeparator(raw, '.');
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return parenthesizedNegative ? -Math.abs(amount) : amount;
}

export function reportHours(item = {}) {
  if (item.hours !== null && item.hours !== undefined && item.hours !== '') {
    const hours = Number(item.hours);
    if (Number.isFinite(hours) && hours >= 0) return hours;
  }

  const rawMinutes = item.minutes ?? item.durationMinutes ?? item.duration_minutes;
  if (rawMinutes !== null && rawMinutes !== undefined && rawMinutes !== '') {
    const minutes = Number(rawMinutes);
    if (Number.isFinite(minutes) && minutes >= 0) return minutes / 60;
  }

  if (item.seconds !== null && item.seconds !== undefined && item.seconds !== '') {
    const seconds = Number(item.seconds);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds / 3600;
  }
  return 0;
}

// Running timers are still changing, so only completed or legacy entries belong in reports.
export function isReportableWorkRecord(item = {}) {
  return String(item.status || '').trim().toLowerCase() !== 'running';
}

export function formatReportHours(value) {
  const totalMinutes = Math.max(0, Math.round((Number(value) || 0) * 60));
  if (!totalMinutes) return '0h';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}min`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function normalizeSingleCurrencySeparator(value, separator) {
  const parts = value.split(separator);
  const groupedThousands = parts.length === 2
    && /^-?\d{1,3}$/.test(parts[0])
    && /^\d{3}$/.test(parts[1]);
  if (groupedThousands) return parts.join('');
  return parts.length === 2 ? `${parts[0]}.${parts[1]}` : value;
}

export const reportDateLabel = (value, preferences = {}) => formatWorkspaceDate(value, preferences);

export function buildProjectReportRows(projects = [], tasks = [], hours = [], periodId, now = new Date(), preferences = {}) {
  const rows = [
    ...projects.filter((item) => inPeriod(item, periodId, now, 'default', preferences)).map((item) => [
      item.name || item.title || 'Projeto', `Projeto · ${item.client || 'Cliente não informado'}`,
      item.status || 'Em andamento', reportDateLabel(item.date || item.createdAt || item.created_at, preferences),
      dateOf(item).getTime(),
    ]),
    ...tasks.filter((item) => inPeriod(item, periodId, now, 'task', preferences)).map((item) => [
      item.title || item.name || 'Tarefa', `Tarefa · ${item.project || item.client || 'Projeto não informado'}`,
      item.status || item.state || 'Em andamento', reportDateLabel(item.due || item.dueAt || item.due_at || item.createdAt || item.created_at, preferences),
      dateOf(item, 'task').getTime(),
    ]),
    ...hours.filter((item) => isReportableWorkRecord(item) && inPeriod(item, periodId, now, 'work', preferences)).map((item) => [
      item.title || item.project || 'Registro de horas', `Horas · ${item.project || item.client || 'Projeto não informado'}`,
      `${reportHours(item)}h · ${item.status || 'Registradas'}`, reportDateLabel(item.date || item.startedAt || item.started_at || item.createdAt || item.created_at, preferences),
      dateOf(item, 'work').getTime(),
    ]),
  ];
  return rows.sort((a, b) => b[4] - a[4]).map(([name, category, status, date]) => [name, category, status, date]);
}

export function buildChartBuckets(periodId, now, rows, valueOf, dateField = 'default', preferences = {}) {
  const timeZone = reportTimeZone(preferences);
  const today = calendarDateInTimeZone(now, timeZone);
  const starts = periodId === 'year'
    ? Array.from({ length: 12 }, (_, index) => new Date(today.getFullYear(), index, 1))
    : periodId === 'quarter'
      ? Array.from({ length: 13 }, (_, index) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89 + index * 7))
      : Array.from({ length: Math.ceil(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() / 7) }, (_, index) => new Date(today.getFullYear(), today.getMonth(), 1 + index * 7));
  const endOfToday = dateKeyFromCalendarDate(today);
  return starts.map((start, index) => {
    const startKey = dateKeyFromCalendarDate(start);
    const end = periodId === 'year'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const endKey = dateKeyFromCalendarDate(end);
    const value = rows.filter((row) => {
      const key = reportDateKey(reportDateValue(row, dateField), timeZone);
      return key >= startKey && key < endKey && key <= endOfToday;
    }).reduce((sum, row) => sum + valueOf(row), 0);
    const label = periodId !== 'year'
      ? formatWorkspaceDate(startKey, preferences, { day: '2-digit', month: 'short' }).replace('.', '')
      : formatWorkspaceDate(startKey, preferences, { month: 'short' }).replace('.', '');
    return { key: `${startKey}-${index}`, label, value };
  });
}
