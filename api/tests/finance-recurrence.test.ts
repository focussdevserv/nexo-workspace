import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinanceRecurrenceDates } from '../src/integrations/finance-recurrence.ts';

test('monthly finance recurrence anchors each date and clamps month ends without drift', () => {
  assert.deepEqual(buildFinanceRecurrenceDates('2026-01-31', '2026-02-05', 'monthly', 4), [
    { date: '2026-01-31', dueDate: '2026-02-05' },
    { date: '2026-02-28', dueDate: '2026-03-05' },
    { date: '2026-03-31', dueDate: '2026-04-05' },
    { date: '2026-04-30', dueDate: '2026-05-05' },
  ]);
});

test('weekly and quarterly recurrence preserve due date offsets', () => {
  assert.deepEqual(buildFinanceRecurrenceDates('2026-10-01', '2026-10-10', 'weekly', 3), [
    { date: '2026-10-01', dueDate: '2026-10-10' },
    { date: '2026-10-08', dueDate: '2026-10-17' },
    { date: '2026-10-15', dueDate: '2026-10-24' },
  ]);
  assert.deepEqual(buildFinanceRecurrenceDates('2026-01-31', null, 'quarterly', 3).map(({ date }) => date), [
    '2026-01-31', '2026-04-30', '2026-07-31',
  ]);
});

test('rejects invalid, non-calendar dates and unsupported recurrence counts', () => {
  assert.throws(() => buildFinanceRecurrenceDates('2026-02-30', null, 'monthly', 3), /finance_recurrence_invalid_date/);
  assert.throws(() => buildFinanceRecurrenceDates('2026-10-01', null, 'monthly', 1), /finance_recurrence_invalid_count/);
  assert.throws(() => buildFinanceRecurrenceDates('2026-10-01', null, 'monthly', 61), /finance_recurrence_invalid_count/);
});
