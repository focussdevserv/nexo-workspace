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

test('the Meu Dia receivables shortcut can show pending charges due within 30 days', () => {
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const items = [
    { id: 'tomorrow', status: 'pending', dueDate: '2026-10-02' },
    { id: 'within-window', status: 'pending', dueDate: '2026-10-25' },
    { id: 'outside-window', status: 'pending', dueDate: '2026-11-15' },
    { id: 'paid', status: 'paid', dueDate: '2026-10-10' },
    { id: 'overdue', status: 'overdue', dueDate: '2026-09-28' },
  ];

  assert.deepEqual(filterPayments(items, { due: 'Pr\u00f3ximos 30 dias', now }).map((item) => item.id), ['tomorrow', 'within-window']);
});

test('matches status filters regardless of case or Portuguese provider labels', () => {
  const items = [
    { id: 'upper', status: 'PENDING' },
    { id: 'localized', status: 'Aguardando pagamento' },
    { id: 'paid', status: 'paid' },
  ];
  assert.deepEqual(filterPayments(items, { status: 'pending' }).map((item) => item.id), ['upper', 'localized']);
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
  assert.deepEqual(filterPayments(items, { due: 'Sem vencimento', now: startOfDay }).map((item) => item.id), ['undated']);
  assert.deepEqual(filterPayments(items, { due: 'Vencidas', now: endOfDueDay + 1 }).map((item) => item.id), ['legacy-today', 'legacy-late']);
});

test('falls back to a valid due date when the provider timestamp is malformed', () => {
  const now = Date.parse('2026-10-01T09:00:00.000Z');
  const items = [
    { id: 'fallback-late', status: 'pending', dueAt: 'not-a-date', dueDate: '2026-09-30' },
    { id: 'fallback-soon', status: 'pending', dueAt: 'not-a-date', dueDate: '2026-10-03' },
    { id: 'invalid', status: 'pending', dueAt: 'not-a-date', dueDate: '2026-02-30' },
    { id: 'missing', status: 'pending' },
  ];

  assert.deepEqual(filterPayments(items, { due: 'Vencidas', now }).map((item) => item.id), ['fallback-late']);
  assert.deepEqual(filterPayments(items, { due: 'Sem vencimento', now }).map((item) => item.id), ['missing']);
});
