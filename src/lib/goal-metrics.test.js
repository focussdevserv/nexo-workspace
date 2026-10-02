import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGoalMetric, isGoalDateInPeriod } from './goal-metrics.js';

const now = new Date('2026-10-02T15:00:00.000Z');
const prefs = { timeZone: 'America/Sao_Paulo', weekStart: 'monday' };

test('date boundaries use workspace timezone and configured week start', () => {
  assert.equal(isGoalDateInPeriod('2026-10-01', 'month', now, prefs), true);
  assert.equal(isGoalDateInPeriod('2026-09-30', 'month', now, prefs), false);
  assert.equal(isGoalDateInPeriod('2026-09-28', 'week', now, prefs), true);
  assert.equal(isGoalDateInPeriod('2026-09-27', 'week', now, prefs), false);
  assert.equal(isGoalDateInPeriod('not-a-date', 'month', now, prefs), false);
});

test('financial goal counts only paid receipts and uses Brazilian decimal values', () => {
  const result = calculateGoalMetric('paid_revenue', {
    orders: [{ status: 'paid', paidAt: '2026-10-01T12:00:00-03:00', amount: 'R$ 1.234,50' }, { status: 'pending', createdAt: '2026-10-01', amount: 800 }],
    revenues: [{ status: 'Recebida', date: '2026-10-02', value: 'R$ 65,50' }],
  }, { orders: 'ready', revenues: 'ready' }, 'month', now, prefs);
  assert.deepEqual(result, { state: 'ready', value: 1300 });
});

test('paid revenue goals use the actual payment date for refreshed orders and settled manual receipts', () => {
  const result = calculateGoalMetric('paid_revenue', {
    orders: [
      { status: 'paid', paymentDetails: { paidAt: '2026-09-30T22:00:00.000Z' }, updatedAt: '2026-10-02T12:00:00.000Z', amount: 100 },
      { status: 'paid', paidAt: '2026-10-01T12:00:00-03:00', updatedAt: '2026-10-02T12:00:00.000Z', amount: 200 },
    ],
    revenues: [
      { status: 'Recebida', date: '2026-09-30', settledAt: '2026-10-01T12:00:00-03:00', amount: 300 },
      { status: 'Recebida', date: '2026-10-01', settledAt: '2026-09-30T12:00:00-03:00', amount: 400 },
    ],
  }, { orders: 'ready', revenues: 'ready' }, 'month', now, prefs);

  assert.deepEqual(result, { state: 'ready', value: 500 });
});

test('paid revenue goals prioritize settlement timestamps on billing orders', () => {
  const result = calculateGoalMetric('paid_revenue', {
    orders: [
      { status: 'paid', settledAt: '2026-10-01T12:00:00-03:00', createdAt: '2026-09-30T12:00:00-03:00', amount: 100 },
      { status: 'paid', settled_at: '2026-09-30T12:00:00-03:00', updatedAt: '2026-10-01T12:00:00-03:00', amount: 200 },
      { status: 'paid', paymentDetails: { settledAt: '2026-10-02T12:00:00-03:00' }, createdAt: '2026-09-30T12:00:00-03:00', amount: 300 },
    ],
  }, { orders: 'ready', revenues: 'ready' }, 'month', now, prefs);

  assert.deepEqual(result, { state: 'ready', value: 400 });
});

test('linked goals distinguish access/load errors from a real zero', () => {
  assert.deepEqual(calculateGoalMetric('won_leads', {}, { leads: 'restricted' }, 'month', now, prefs), { state: 'restricted', value: null });
  assert.deepEqual(calculateGoalMetric('won_leads', { leads: [] }, { leads: 'ready' }, 'month', now, prefs), { state: 'ready', value: 0 });
});

test('won-lead goals use the conversion update date instead of the original lead creation date', () => {
  const result = calculateGoalMetric('won_leads', {
    leads: [
      { stage: 'Ganho', createdAt: '2026-09-10T12:00:00-03:00', updatedAt: '2026-10-01T12:00:00-03:00' },
      { stage: 'Ganho', createdAt: '2026-09-10T12:00:00-03:00', updatedAt: '2026-09-30T12:00:00-03:00' },
      { stage: 'Ganho', createdAt: '2026-10-01' },
    ],
  }, { leads: 'ready' }, 'month', now, prefs);

  assert.equal(result.value, 2);
});

test('commercial, project and hours metrics derive results from matching records', () => {
  const data = {
    leads: [{ stage: 'Fechado', createdAt: '2026-10-01' }, { status: 'perdido', createdAt: '2026-10-01' }],
    projects: [{ status: 'Concluído', completedAt: '2026-10-01' }, { status: 'Em andamento', updatedAt: '2026-10-01' }],
    hours: [{ endedAt: '2026-10-01T10:00:00-03:00', minutes: 90 }, { endedAt: '2026-09-01', hours: 6 }],
  };
  const ready = { leads: 'ready', projects: 'ready', hours: 'ready' };
  assert.equal(calculateGoalMetric('won_leads', data, ready, 'month', now, prefs).value, 1);
  assert.equal(calculateGoalMetric('completed_projects', data, ready, 'month', now, prefs).value, 1);
  assert.equal(calculateGoalMetric('registered_hours', data, ready, 'month', now, prefs).value, 1.5);
});

test('hours goals fall back from null hours and minutes to stored timer seconds', () => {
  const result = calculateGoalMetric('registered_hours', {
    hours: [
      { endedAt: '2026-10-01T10:00:00-03:00', hours: null, minutes: null, seconds: 1800 },
      { endedAt: '2026-10-01T11:00:00-03:00', seconds: 900 },
      { endedAt: '2026-10-01T12:00:00-03:00', hours: 0, seconds: 3600 },
    ],
  }, { hours: 'ready' }, 'month', now, prefs);

  assert.equal(result.value, 0.75);
});
