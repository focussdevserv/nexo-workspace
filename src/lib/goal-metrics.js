import { calendarDateKeyForValue, calendarDateKeyInTimeZone, calendarDateInTimeZone, normalizeWeekStart, startOfCalendarWeek } from './calendar-preferences.js';
import { isReportableWorkRecord, parseReportAmount } from './reports.js';

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const firstValue = (item, keys) => keys.map((key) => key.split('.').reduce((value, segment) => value?.[segment], item)).find((value) => value !== undefined && value !== null && value !== '');
const paidStatuses = new Set(['paid', 'processed', 'approved', 'paga', 'pago', 'recebida', 'received', 'conciliada', 'conciliado']);

export const goalMetricDefinitions = {
  manual: { label: 'Atualizado manualmente', unit: null, source: null },
  paid_revenue: { label: 'Receita recebida', unit: 'BRL', source: ['orders', 'revenues'] },
  won_leads: { label: 'Negócios ganhos', unit: 'number', source: ['leads'] },
  completed_projects: { label: 'Projetos concluídos', unit: 'number', source: ['projects'] },
  registered_hours: { label: 'Horas registradas', unit: 'hours', source: ['hours'] },
};

export function isGoalDateInPeriod(value, period, now = new Date(), { timeZone = 'America/Sao_Paulo', weekStart = 'monday' } = {}) {
  const key = calendarDateKeyForValue(value, timeZone);
  if (!key) return false;
  const todayKey = calendarDateKeyInTimeZone(now, timeZone);
  const today = calendarDateInTimeZone(now, timeZone);
  const start = period === 'week'
    ? startOfCalendarWeek(today, normalizeWeekStart(weekStart))
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const startKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return key >= startKey && key <= todayKey;
}

export function calculateGoalMetric(metric, data = {}, states = {}, period = 'month', now = new Date(), preferences = {}) {
  if (!goalMetricDefinitions[metric] || metric === 'manual') return { state: 'manual', value: null };
  const dependencies = goalMetricDefinitions[metric].source;
  const unavailable = dependencies.map((key) => states[key]).find((state) => state && state !== 'ready');
  if (unavailable) return { state: unavailable, value: null };
  const calendarPreferences = { ...preferences, timeZone: preferences.timeZone || preferences.timezone };
  const inPeriod = (item, keys) => isGoalDateInPeriod(firstValue(item, keys), period, now, calendarPreferences);

  if (metric === 'paid_revenue') {
    const orders = (data.orders || []).filter((item) => paidStatuses.has(normalize(item.status))
      && inPeriod(item, ['settledAt', 'settled_at', 'paidAt', 'paid_at', 'paymentDetails.settledAt', 'paymentDetails.paidAt', 'paymentDetails.paid_at', 'updatedAt', 'updated_at', 'createdAt', 'created_at', 'date']));
    const revenues = (data.revenues || []).filter((item) => paidStatuses.has(normalize(item.status))
      && inPeriod(item, ['settledAt', 'settled_at', 'paidAt', 'paid_at', 'date', 'createdAt', 'created_at', 'updatedAt', 'updated_at']));
    return { state: 'ready', value: [...orders, ...revenues].reduce((sum, item) => sum + parseReportAmount(item.amount ?? item.value), 0) };
  }
  if (metric === 'won_leads') {
    const won = (data.leads || []).filter((item) => ['ganho', 'fechado', 'won', 'closed'].includes(normalize(item.stage))
      || ['ganho', 'fechado', 'won', 'closed'].includes(normalize(item.status)));
    return { state: 'ready', value: won.filter((item) => inPeriod(item, ['wonAt', 'won_at', 'closedAt', 'closed_at', 'updatedAt', 'updated_at', 'createdAt', 'created_at', 'date'])).length };
  }
  if (metric === 'completed_projects') {
    const completed = (data.projects || []).filter((item) => ['concluido', 'completed', 'publicado', 'entregue'].includes(normalize(item.status)));
    return { state: 'ready', value: completed.filter((item) => inPeriod(item, ['completedAt', 'completed_at', 'updatedAt', 'updated_at', 'createdAt', 'created_at'])).length };
  }
  if (metric === 'registered_hours') {
    const hours = (data.hours || []).filter((item) => isReportableWorkRecord(item) && inPeriod(item, ['endedAt', 'ended_at', 'startedAt', 'started_at', 'date', 'createdAt', 'created_at']));
    const value = hours.reduce((sum, item) => {
      const explicitHours = item.hours === null || item.hours === undefined || item.hours === '' ? Number.NaN : Number(item.hours);
      if (Number.isFinite(explicitHours) && explicitHours >= 0) return sum + explicitHours;
      const rawMinutes = item.minutes ?? item.durationMinutes ?? item.duration_minutes;
      const minutes = rawMinutes === null || rawMinutes === undefined || rawMinutes === '' ? Number.NaN : Number(rawMinutes);
      if (Number.isFinite(minutes) && minutes >= 0) return sum + minutes / 60;
      const rawSeconds = item.seconds ?? item.durationSeconds ?? item.duration_seconds;
      const seconds = rawSeconds === null || rawSeconds === undefined || rawSeconds === '' ? Number.NaN : Number(rawSeconds);
      return Number.isFinite(seconds) && seconds >= 0 ? sum + seconds / 3600 : sum;
    }, 0);
    return { state: 'ready', value };
  }
  return { state: 'failed', value: null };
}

export function calculateGoalsSummary(goals = [], data = {}, states = {}, period = 'month', now = new Date(), preferences = {}) {
  const visible = goals.filter((goal) => goal.period === period);
  const measurable = visible.flatMap((goal) => {
    const target = Number(goal.target);
    if (!Number.isFinite(target) || target <= 0) return [];
    const current = !goal.metric || goal.metric === 'manual'
      ? (Number.isFinite(Number(goal.current)) ? Math.max(0, Number(goal.current)) : 0)
      : calculateGoalMetric(goal.metric, data, states, goal.period || period, now, preferences).value;
    if (current === null || !Number.isFinite(current)) return [];
    return [{ current, target }];
  });
  const achieved = measurable.filter(({ current, target }) => current >= target).length;
  // An average over only the goals whose sources loaded would overstate the
  // workspace progress when other visible goals are unavailable.
  const averageProgress = measurable.length && measurable.length === visible.length
    ? Math.round(measurable.reduce((sum, { current, target }) => sum + Math.max(0, Math.min(100, Math.round(current / target * 100))), 0) / measurable.length)
    : null;

  return {
    visibleCount: visible.length,
    measurableCount: measurable.length,
    achieved,
    averageProgress,
    revenue: calculateGoalMetric('paid_revenue', data, states, period, now, preferences),
  };
}
