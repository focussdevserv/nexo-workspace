import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOverduePayments, filterPayments } from './payment-filters.js';

test('filters only pending payments whose due time has passed', () => {
  const items = [
    { id: 'late', status: 'pending', dueAt: '2026-09-30T12:00:00.000Z' },
    { id: 'today', status: 'pending', dueAt: '2026-10-01T12:00:00.000Z' },
    { id: 'provider-overdue', status: 'overdue', dueAt: '2026-10-02T12:00:00.000Z' },
    { id: 'paid', status: 'paid', dueAt: '2026-09-01T12:00:00.000Z' },
    { id: 'expired', status: 'expired', dueAt: '2026-09-01T12:00:00.000Z' },
    { id: 'no-date', status: 'pending' },
  ];
  assert.deepEqual(filterOverduePayments(items, Date.parse('2026-10-01T00:00:00.000Z')).map((item) => item.id), ['late', 'provider-overdue']);
});

test('recognizes Portuguese overdue statuses without treating expired orders as overdue', () => {
  const items = [
    { id: 'vencida', status: 'Vencida' },
    { id: 'atrasada', status: 'atrasada' },
    { id: 'expirada', status: 'expired' },
  ];
  assert.deepEqual(filterOverduePayments(items, Date.parse('2026-10-01T00:00:00.000Z')).map((item) => item.id), ['vencida', 'atrasada']);
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

test('uses legacy date-only dueDate values as local calendar dates', () => {
  const startOfDay = new Date(2026, 9, 1, 9, 0, 0).getTime();
  const endOfDueDay = new Date(2026, 9, 1, 23, 59, 59, 999).getTime();
  const items = [
    { id: 'legacy-today', status: 'pending', dueDate: '2026-10-01' },
    { id: 'legacy-late', status: 'pending', dueDate: '2026-09-30' },
    { id: 'invalid-date', status: 'pending', dueDate: '2026-02-30' },
    { id: 'undated', status: 'pending' },
  ];

  assert.deepEqual(filterPayments(items, { due: 'Vencidas', now: startOfDay }).map((item) => item.id), ['legacy-late']);
  assert.deepEqual(filterPayments(items, { due: 'Vencidas', now: endOfDueDay }).map((item) => item.id), ['legacy-late']);
  assert.deepEqual(filterPayments(items, { due: 'Próximos 7 dias', now: startOfDay }).map((item) => item.id), ['legacy-today']);
  assert.deepEqual(filterPayments(items, { due: 'Sem vencimento', now: startOfDay }).map((item) => item.id), ['invalid-date', 'undated']);
  assert.deepEqual(filterPayments(items, { due: 'Vencidas', now: endOfDueDay + 1 }).map((item) => item.id), ['legacy-today', 'legacy-late']);
});
