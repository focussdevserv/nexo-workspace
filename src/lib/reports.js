export const dateOf = (item, field = 'default') => {
  const candidates = field === 'created' ? [item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
    : field === 'expense' ? [item.date, item.createdAt, item.created_at, item.updatedAt, item.updated_at]
      : field === 'paid' ? [item.settledAt, item.settled_at, item.paidAt, item.paid_at, item.paymentDetails?.paidAt, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
      : field === 'completed' ? [item.completedAt, item.completed_at, item.updatedAt, item.updated_at, item.createdAt, item.created_at]
          : field === 'work' ? [item.startedAt, item.started_at, item.endedAt, item.ended_at, item.createdAt, item.created_at, item.date]
            : field === 'task' ? [item.due, item.dueAt, item.due_at, item.createdAt, item.created_at, item.date, item.updatedAt, item.updated_at]
            : [item.date, item.createdAt, item.created_at, item.paidAt, item.paid_at, item.updatedAt, item.updated_at, item.dueAt, item.due_at];
  const value = candidates.find((candidate) => candidate !== null && candidate !== undefined && candidate !== '');
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return value === undefined ? new Date(Number.NaN) : new Date(value);
};

export const periodStart = (periodId, now = new Date()) => periodId === 'year'
  ? new Date(now.getFullYear(), 0, 1)
  : periodId === 'quarter'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0)
    : new Date(now.getFullYear(), now.getMonth(), 1);

export const inPeriod = (item, periodId, now = new Date(), field = 'default') => {
  const date = dateOf(item, field);
  return !Number.isNaN(date.getTime()) && date >= periodStart(periodId, now) && date <= now;
};

const paidReportStatuses = new Set(['paid', 'processed', 'approved', 'paga', 'pago', 'recebida', 'received', 'conciliada', 'conciliado']);
const normalizedStatus = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// Manual receipts belong to the period in which they were settled, not the
// period when the revenue row was first created or its original due date.
export function paidReportRevenues(records = [], periodId, now = new Date()) {
  return records.filter((item) => paidReportStatuses.has(normalizedStatus(item.status)) && inPeriod(item, periodId, now, 'paid'));
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

export const reportDateLabel = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, year, month, day] = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return `${day}/${month}/${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR').format(date);
};

export function buildProjectReportRows(projects = [], tasks = [], hours = [], periodId, now = new Date()) {
  const rows = [
    ...projects.filter((item) => inPeriod(item, periodId, now)).map((item) => [
      item.name || item.title || 'Projeto', `Projeto · ${item.client || 'Cliente não informado'}`,
      item.status || 'Em andamento', reportDateLabel(item.date || item.createdAt || item.created_at),
      dateOf(item).getTime(),
    ]),
    ...tasks.filter((item) => inPeriod(item, periodId, now, 'task')).map((item) => [
      item.title || item.name || 'Tarefa', `Tarefa · ${item.project || item.client || 'Projeto não informado'}`,
      item.status || item.state || 'Em andamento', reportDateLabel(item.due || item.dueAt || item.due_at || item.createdAt || item.created_at),
      dateOf(item, 'task').getTime(),
    ]),
    ...hours.filter((item) => inPeriod(item, periodId, now, 'work')).map((item) => [
      item.title || item.project || 'Registro de horas', `Horas · ${item.project || item.client || 'Projeto não informado'}`,
      `${reportHours(item)}h · ${item.status || 'Registradas'}`, reportDateLabel(item.date || item.startedAt || item.started_at || item.createdAt || item.created_at),
      dateOf(item, 'work').getTime(),
    ]),
  ];
  return rows.sort((a, b) => b[4] - a[4]).map(([name, category, status, date]) => [name, category, status, date]);
}

export function buildChartBuckets(periodId, now, rows, valueOf, dateField = 'default') {
  const starts = periodId === 'year'
    ? Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), index, 1))
    : periodId === 'quarter'
      ? Array.from({ length: 13 }, (_, index) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 89 + index * 7); return date; })
      : [new Date(now.getFullYear(), now.getMonth(), 1)];
  return starts.map((start, index) => {
    const end = periodId === 'year' || periodId === 'month'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const value = rows.filter((row) => { const date = dateOf(row, dateField); return date >= start && date < end && date <= now; }).reduce((sum, row) => sum + valueOf(row), 0);
    const label = periodId === 'quarter'
      ? start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
      : start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return { key: `${start.toISOString()}-${index}`, label, value };
  });
}
