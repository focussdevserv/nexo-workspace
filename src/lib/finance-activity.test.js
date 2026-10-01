import test from 'node:test';
import assert from 'node:assert/strict';
import { sortFinanceActivity } from './finance-cashflow.js';

test('orders income and expense activity newest first before applying the limit', () => {
  const rows = [
    { id: 'income-old', date: '2026-01-01' },
    { id: 'expense-new', date: '2026-03-01' },
    { id: 'income-middle', date: '2026-02-01' },
  ];
  assert.deepEqual(sortFinanceActivity(rows, 2).map((row) => row.id), ['expense-new', 'income-middle']);
});

test('keeps undated activity after dated entries', () => {
  const rows = [{ id: 'unknown' }, { id: 'dated', date: '2026-03-01' }];
  assert.deepEqual(sortFinanceActivity(rows).map((row) => row.id), ['dated', 'unknown']);
});
