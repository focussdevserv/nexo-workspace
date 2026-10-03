import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartBuckets, buildProjectReportRows, dateOf, formatReportHours, hasReportChartFailures, hasReportSourceFailures, inPeriod, paidReportRevenues, parseReportAmount, periodStart, reportDateLabel, reportHours, reportSourceState, reportSourcesForTab } from './reports.js';

test('report amounts parse Brazilian and US mixed thousands and decimal separators', () => {
  assert.equal(parseReportAmount('R$ 1.234,56'), 1234.56);
  assert.equal(parseReportAmount('$1,234.56'), 1234.56);
  assert.equal(parseReportAmount('1,234'), 1234);
  assert.equal(parseReportAmount('$1,234'), 1234);
  assert.equal(parseReportAmount('1,23'), 1.23);
  assert.equal(parseReportAmount('1.234'), 1234);
  assert.equal(parseReportAmount('1234.56'), 1234.56);
  assert.equal(parseReportAmount('(R$ 1.234,56)'), -1234.56);
  assert.equal(parseReportAmount('valor inválido'), 0);
});

test('year period starts on January 1 instead of a rolling 12-month window', () => {
  const now = new Date(2026, 9, 30, 12);
  assert.equal(periodStart('year', now).getTime(), new Date(2026, 0, 1).getTime());
  assert.equal(inPeriod({ createdAt: '2026-01-01T12:00:00' }, 'year', now, 'created'), true);
  assert.equal(inPeriod({ createdAt: '2025-12-31T23:59:59' }, 'year', now, 'created'), false);
});

test('90-day window includes the start date and excludes the prior day', () => {
  const now = new Date(2026, 8, 30, 12);
  const start = periodStart('quarter', now);
  assert.equal(inPeriod({ createdAt: start.toISOString() }, 'quarter', now, 'created'), true);
  assert.equal(inPeriod({ createdAt: new Date(start.getTime() - 1).toISOString() }, 'quarter', now, 'created'), false);
});

test('date-only values are grouped in the local calendar day without UTC rollover', () => {
  const date = dateOf({ date: '2026-10-01' }, 'expense');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9);
  assert.equal(date.getDate(), 1);
});

test('snake-case timestamps are recognized for API and imported records', () => {
  const paidAt = dateOf({ paid_at: '2026-09-17T14:30:00.000Z' }, 'paid');
  assert.equal(paidAt.toISOString(), '2026-09-17T14:30:00.000Z');
  assert.equal(inPeriod({ created_at: '2026-09-17T14:30:00.000Z' }, 'quarter', new Date('2026-09-30T23:59:00.000Z'), 'created'), true);
  assert.equal(inPeriod({ ended_at: '2026-09-17T14:30:00.000Z' }, 'quarter', new Date('2026-09-30T23:59:00.000Z'), 'work'), true);
});

test('paid billing reports keep using the stored approval date after later refreshes', () => {
  const order = {
    status: 'paid',
    paymentDetails: { paidAt: '2026-09-30T21:20:00.000Z' },
    updatedAt: '2026-10-02T12:30:00.000Z',
  };
  assert.equal(dateOf(order, 'paid').toISOString(), '2026-09-30T21:20:00.000Z');
  assert.equal(inPeriod(order, 'month', new Date('2026-10-02T13:00:00.000Z'), 'paid'), false);
});

test('paid billing reports use nested settlement timestamps before later update dates', () => {
  const now = new Date('2026-10-02T15:00:00.000Z');
  const order = {
    status: 'paid',
    paymentDetails: { settled_at: '2026-09-30T22:00:00.000Z' },
    updatedAt: '2026-10-02T12:30:00.000Z',
  };

  assert.equal(dateOf(order, 'paid').toISOString(), '2026-09-30T22:00:00.000Z');
  assert.equal(inPeriod(order, 'month', now, 'paid'), false);
});

test('paid manual revenues are reported in their settlement period, not creation period', () => {
  const now = new Date('2026-10-02T15:00:00.000Z');
  const revenues = [
    { id: 'settled-this-month', status: 'Recebida', date: '2026-09-30', createdAt: '2026-09-30T10:00:00Z', settledAt: '2026-10-01T10:00:00Z', amount: 250 },
    { id: 'settled-last-month', status: 'Recebida', date: '2026-10-01', settledAt: '2026-09-30T10:00:00Z', amount: 500 },
    { id: 'pending', status: 'Pendente', date: '2026-10-01', amount: 700 },
  ];

  assert.deepEqual(paidReportRevenues(revenues, 'month', now).map(({ id }) => id), ['settled-this-month']);
  assert.equal(dateOf(revenues[0], 'paid').toISOString(), '2026-10-01T10:00:00.000Z');
});

test('records with no date are excluded instead of being treated as epoch dated', () => {
  assert.equal(Number.isNaN(dateOf({}, 'created').getTime()), true);
  assert.equal(inPeriod({}, 'year', new Date(2026, 9, 2), 'created'), false);
});

test('report source state distinguishes missing permission from a failed request', () => {
  assert.equal(reportSourceState('orders', ['orders'], ['orders']), 'restricted');
  assert.equal(reportSourceState('orders', [], ['orders']), 'failed');
  assert.equal(reportSourceState('orders', [], []), 'ready');
});

test('report export scope includes only sources that feed the active report', () => {
  assert.deepEqual(reportSourcesForTab('Financeiro'), ['orders', 'revenues', 'expenses']);
  assert.equal(reportSourcesForTab('Financeiro').includes('tasks'), false);
  assert.deepEqual(reportSourcesForTab('Projetos'), ['projects', 'tasks', 'hours']);
  assert.deepEqual(reportSourcesForTab('Comercial'), ['leads', 'orders', 'revenues']);
  assert.deepEqual(reportSourcesForTab('Visão geral'), ['leads', 'projects', 'expenses', 'orders', 'revenues']);
});

test('an unrelated source failure does not block export of the current report', () => {
  assert.equal(hasReportSourceFailures('Financeiro', ['hours', 'tasks']), false);
  assert.equal(hasReportSourceFailures('Financeiro', ['expenses']), true);
  assert.equal(hasReportSourceFailures('Projetos', ['expenses']), false);
  assert.equal(hasReportSourceFailures('Projetos', ['hours']), true);
});

test('an unrelated source failure does not hide a report chart with all its own data', () => {
  assert.equal(hasReportChartFailures('Visão geral', ['tasks', 'hours']), false);
  assert.equal(hasReportChartFailures('Visão geral', ['revenues']), true);
  assert.equal(hasReportChartFailures('Financeiro', ['leads']), false);
  assert.equal(hasReportChartFailures('Comercial', ['projects']), false);
  assert.equal(hasReportChartFailures('Projetos', ['hours']), false);
  assert.equal(hasReportChartFailures('Projetos', ['projects']), true);
});

test('report date labels preserve date-only values and handle missing dates', () => {
  assert.equal(reportDateLabel('2026-10-02'), '02/10/2026');
  assert.equal(reportDateLabel(''), '—');
});

test('project reports count legacy duration fields and retain fractional hours', () => {
  assert.equal(reportHours({ minutes: 45 }), 0.75);
  assert.equal(reportHours({ durationMinutes: 90 }), 1.5);
  assert.equal(reportHours({ duration_minutes: 30 }), 0.5);
  assert.equal(reportHours({ seconds: 1800 }), 0.5);
  assert.equal(reportHours({ hours: 2.25, minutes: 45 }), 2.25);
  assert.equal(formatReportHours(0), '0h');
  assert.equal(formatReportHours(0.75), '45min');
  assert.equal(formatReportHours(1.5), '1h 30min');
});

test('annual chart builds calendar-month buckets and sums only real matching records', () => {
  const now = new Date(2026, 9, 30, 12);
  const buckets = buildChartBuckets('year', now, [
    { createdAt: '2026-01-14T12:00:00', amount: 120 },
    { createdAt: '2026-01-28T12:00:00', amount: 30 },
    { createdAt: '2025-12-31T12:00:00', amount: 500 },
    { createdAt: '2026-11-03T12:00:00', amount: 900 },
  ], (row) => row.amount, 'created');
  assert.equal(buckets.length, 12);
  assert.equal(buckets[0].value, 150);
  assert.equal(buckets[9].value, 0);
  assert.equal(buckets[11].value, 0);
});

test('90-day chart uses weekly buckets that cover the full selected range', () => {
  const now = new Date(2026, 8, 30, 12);
  const start = periodStart('quarter', now);
  const buckets = buildChartBuckets('quarter', now, [
    { createdAt: new Date(start.getTime() + 60_000).toISOString(), amount: 25 },
    { createdAt: now.toISOString(), amount: 75 },
    { createdAt: new Date(start.getTime() - 1).toISOString(), amount: 100 },
  ], (row) => row.amount, 'created');
  assert.equal(buckets.length, 13);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.value, 0), 100);
});

test('project report lists dated tasks and work-hour records alongside projects', () => {
  const now = new Date(2026, 9, 2, 12);
  const rows = buildProjectReportRows(
    [{ name: 'Site Aurora', client: 'Aurora', createdAt: '2026-10-01T09:00:00', status: 'Em andamento' }],
    [
      { title: 'Revisar página', project: 'Site Aurora', due: '2026-10-02', status: 'Pendente' },
      { title: 'Tarefa antiga', project: 'Site Aurora', due: '2026-09-30', status: 'Concluída' },
    ],
    [{ title: 'Implementação', project: 'Site Aurora', hours: 2.5, startedAt: '2026-10-01T10:00:00-03:00', status: 'completed' }],
    'month',
    now,
  );

  assert.deepEqual(rows.map(([name]) => name), ['Revisar página', 'Implementação', 'Site Aurora']);
  assert.deepEqual(rows[0], ['Revisar página', 'Tarefa · Site Aurora', 'Pendente', '02/10/2026']);
  assert.deepEqual(rows[1], ['Implementação', 'Horas · Site Aurora', '2.5h · completed', '01/10/2026']);
  assert.equal(rows.some(([name]) => name === 'Tarefa antiga'), false);
});
