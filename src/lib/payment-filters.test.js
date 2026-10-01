import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOverduePayments, filterPayments } from './payment-filters.js';

test('filters only pending payments whose due time has passed', () => {
  const items = [
    { id: 'late', status: 'pending', dueAt: '2026-09-30T12:00:00.000Z' },
    { id: 'today', status: 'pending', dueAt: '2026-10-01T12:00:00.000Z' },
    { id: 'paid', status: 'paid', dueAt: '2026-09-01T12:00:00.000Z' },
    { id: 'no-date', status: 'pending' },
  ];
  assert.deepEqual(filterOverduePayments(items, Date.parse('2026-10-01T00:00:00.000Z')).map((item) => item.id), ['late']);
});

test('filters payments by exact provider status and upcoming or missing due date', () => {
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const items = [
    { id: 'late', status: 'pending', dueAt: '2026-09-30T12:00:00.000Z' },
    { id: 'soon', status: 'pending', dueAt: '2026-10-05T12:00:00.000Z' },
    { id: 'future', status: 'pending', dueAt: '2026-10-20T12:00:00.000Z' },
    { id: 'paid', status: 'paid', dueAt: '2026-10-05T12:00:00.000Z' },
    { id: 'undated', status: 'pending' },
  ];
  assert.deepEqual(filterPayments(items, { status: 'pending', due: 'Próximos 7 dias', now }).map((item) => item.id), ['soon']);
  assert.deepEqual(filterPayments(items, { due: 'Sem vencimento', now }).map((item) => item.id), ['undated']);
});
