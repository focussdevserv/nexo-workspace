import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardBillingMetrics } from './dashboard-billing-metrics.js';

test('Meu Dia includes authorized recurring subscriptions in the next 30 days', () => {
  const result = dashboardBillingMetrics([
    { id: 'order', billingKind: 'order', status: 'pending', amount: 80, dueAt: '2026-10-10T12:00:00.000Z' },
    { id: 'subscription', billingKind: 'subscription', status: 'authorized', amount: 1200, nextPaymentAt: '2026-10-18T12:00:00.000Z' },
    { id: 'paused-subscription', billingKind: 'subscription', status: 'paused', amount: 900, nextPaymentAt: '2026-10-18T12:00:00.000Z' },
  ], { today: '2026-10-03', through: '2026-11-02', timeZone: 'UTC' });

  assert.equal(result.upcomingAmount, 1280);
  assert.deepEqual(result.overdueBills, []);
});

test('Meu Dia counts overdue active subscriptions and excludes finished or failed orders', () => {
  const result = dashboardBillingMetrics([
    { id: 'late-subscription', billingKind: 'subscription', status: 'authorized', amount: 1200, nextPaymentAt: '2026-10-01T12:00:00.000Z' },
    { id: 'expired-order', billingKind: 'order', status: 'expired', amount: 35, dueAt: '2026-10-01T12:00:00.000Z' },
    { id: 'failed-order', billingKind: 'order', status: 'failed', amount: 50, dueAt: '2026-10-08T12:00:00.000Z' },
    { id: 'paid-order', billingKind: 'order', status: 'paid', amount: 25, dueAt: '2026-10-01T12:00:00.000Z' },
  ], { today: '2026-10-03', through: '2026-11-02', timeZone: 'UTC' });

  assert.deepEqual(result.overdueBills.map(({ id }) => id), ['late-subscription']);
  assert.equal(result.upcomingAmount, 0);
});

test('Meu Dia safely handles malformed rows and ignores dates outside the shown window', () => {
  const result = dashboardBillingMetrics([
    null,
    'invalid',
    { id: 'future', status: 'pending', amount: 60, dueAt: '2026-11-20T12:00:00.000Z' },
    { id: 'no-date', status: 'pending', amount: 60 },
  ], { today: '2026-10-03', through: '2026-11-02', timeZone: 'UTC' });

  assert.deepEqual(result.overdueBills, []);
  assert.equal(result.upcomingAmount, 0);
});
