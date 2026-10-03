import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChartBuckets, buildProjectReportRows, canExportReport, dateOf, formatReportHours, hasReportChartFailures, hasReportSourceFailures, inPeriod, isReportableWorkRecord, paidReportPayments, paidReportRevenues, parseReportAmount, periodStart, reportDateLabel, reportHours, reportRevenueDate, reportSourceState, reportSourcesForTab, revenueRecordsForReport } from './reports.js';

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

test('report period filtering follows the workspace timezone across month boundaries', () => {
  const now = new Date('2026-10-01T04:00:00.000Z');
  const records = [
    { id: 'previous-local-day', createdAt: '2026-10-01T01:00:00.000Z' },
    { id: 'current-local-day', createdAt: '2026-10-01T04:00:00.000Z' },
    { id: 'date-only', createdAt: '2026-10-01' },
  ];

  assert.deepEqual(records.filter((item) => inPeriod(item, 'month', now, 'created', { timezone: 'America/Sao_Paulo' })).map(({ id }) => id), ['current-local-day', 'date-only']);
  assert.deepEqual(records.filter((item) => inPeriod(item, 'month', now, 'created', { timezone: 'UTC' })).map(({ id }) => id), ['previous-local-day', 'current-local-day', 'date-only']);
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

test('billing reports include every paid status recognized by the financial report rules', () => {
  const now = new Date('2026-10-02T15:00:00.000Z');
  const orders = [
    { id: 'paid', status: 'paid', paidAt: '2026-10-01T10:00:00.000Z' },
    { id: 'received', status: 'received', paidAt: '2026-10-01T11:00:00.000Z' },
    { id: 'conciliated', status: 'Conciliada', paidAt: '2026-10-01T12:00:00.000Z' },
    { id: 'pending', status: 'pending', paidAt: '2026-10-01T13:00:00.000Z' },
    { id: 'outside-period', status: 'approved', paidAt: '2026-09-30T23:59:00.000Z' },
  ];

  assert.deepEqual(paidReportPayments(orders, 'month', now).map(({ id }) => id), ['paid', 'received', 'conciliated']);
});

test('report revenue rows and chart dates follow settlement for paid entries', () => {
  const now = new Date('2026-10-02T15:00:00.000Z');
  const records = [
    { id: 'settled-now', status: 'Recebida', date: '2026-09-30', settledAt: '2026-10-01T10:00:00Z', amount: 250 },
    { id: 'settled-before', status: 'Recebida', date: '2026-10-01', settledAt: '2026-09-30T10:00:00Z', amount: 500 },
    { id: 'pending-now', status: 'Pendente', date: '2026-10-01', createdAt: '2026-09-30T10:00:00Z', amount: 700 },
  ];

  const current = revenueRecordsForReport(records, 'month', now);
  assert.deepEqual(current.map(({ id }) => id), ['settled-now', 'pending-now']);
  assert.equal(reportRevenueDate(current[0]).toISOString(), '2026-10-01T10:00:00.000Z');
  assert.equal(reportRevenueDate(current[1]).getDate(), 1);
  const chart = buildChartBuckets('month', now, current.filter(({ status }) => status === 'Recebida'), (row) => row.amount, 'paid');
  assert.equal(chart.reduce((sum, bucket) => sum + bucket.value, 0), 250);
});

test('paid manual revenue falls back to its accounting date when no settlement timestamp exists', () => {
  const record = { status: 'Recebida', date: '2026-10-01', amount: 250 };
  assert.equal(reportRevenueDate(record).getDate(), 1);
  assert.deepEqual(paidReportRevenues([record], 'month', new Date('2026-10-02T12:00:00')), [record]);
  const chartRows = [{ ...record, paidAt: reportRevenueDate(record) }];
  const chart = buildChartBuckets('month', new Date('2026-10-02T12:00:00'), chartRows, (item) => item.amount, 'paid');
  assert.equal(chart.reduce((sum, bucket) => sum + bucket.value, 0), 250);
});

test('paid billing orders keep the original updatedAt fallback when date may be the due date', () => {
  const order = { status: 'paid', date: '2026-09-20', updatedAt: '2026-10-01T12:00:00Z' };
  assert.equal(dateOf(order, 'paid').toISOString(), '2026-10-01T12:00:00.000Z');
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

test('report export is blocked when a contributing source is restricted or failed', () => {
  assert.equal(canExportReport('Financeiro', ['orders'], []), false);
  assert.equal(canExportReport('Projetos', [], ['hours']), false);
  assert.equal(canExportReport('Visão geral', ['expenses'], []), false);
  assert.equal(canExportReport('Financeiro', ['hours'], []), true);
  assert.equal(canExportReport('Financeiro', [], ['tasks']), true);
  assert.equal(canExportReport('Comercial', [], []), true);
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
  assert.equal(reportDateLabel('2026-10-02', { language: 'en-US', dateFormat: 'MM/dd/yyyy' }), '10/02/2026');
  assert.equal(reportDateLabel(''), '—');
});

test('report chart month labels follow workspace language', () => {
  const now = new Date('2026-10-20T12:00:00');
  const rows = [{ paidAt: '2026-10-02', amount: 5 }];
  const en = buildChartBuckets('year', now, rows, (item) => item.amount, 'paid', { language: 'en-US' });
  const pt = buildChartBuckets('year', now, rows, (item) => item.amount, 'paid', { language: 'pt-BR' });
  assert.equal(en[9].label, 'Oct');
  assert.equal(pt[9].label, 'out');
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

test('project report hours omit running timers while keeping completed and legacy records', () => {
  const rows = buildProjectReportRows([], [], [
    { id: 'active', status: 'running', title: 'Timer', startedAt: '2026-10-01T10:00:00Z', hours: 5 },
    { id: 'completed', status: 'completed', title: 'Finished', endedAt: '2026-10-01T10:00:00Z', hours: 1.5 },
    { id: 'legacy', title: 'Legacy', date: '2026-10-01', minutes: 30 },
  ], 'month', new Date('2026-10-02T12:00:00Z'), { timezone: 'UTC' });

  assert.deepEqual(rows.map((row) => row[0]), ['Finished', 'Legacy']);
  assert.equal(isReportableWorkRecord({ status: 'running' }), false);
  assert.equal(isReportableWorkRecord({ status: 'completed' }), true);
  assert.equal(isReportableWorkRecord({}), true);
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

test('monthly report chart groups receipts into calendar weeks instead of one misleading total bar', () => {
  const now = new Date(2026, 9, 10, 12);
  const buckets = buildChartBuckets('month', now, [
    { createdAt: '2026-10-01T09:00:00', amount: 100 },
    { createdAt: '2026-10-08T09:00:00', amount: 250 },
    { createdAt: '2026-10-11T09:00:00', amount: 500 },
    { createdAt: '2026-11-01T09:00:00', amount: 800 },
  ], (row) => row.amount, 'created');

  assert.equal(buckets.length, 5);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.value, 0), 350);
  assert.deepEqual(buckets.map((bucket) => bucket.value), [100, 250, 0, 0, 0]);
  assert.match(buckets[0].label, /^01/);
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
