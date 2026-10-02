import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCashflowMonths, filterFinanceRecords, financeRecordActionKey, financeRecordsCsv, isFinanceReceivableOpen, isFinanceRecordOverdue } from './finance-cashflow.js';

test('uses immutable workspace IDs for finance actions even when display codes collide', () => {
  const records = [
    { id: 'record-a', code: 'REC-12345' },
    { id: 'record-b', code: 'REC-12345' },
  ];
  const actionKey = financeRecordActionKey(records[1]);
  assert.equal(actionKey, 'record-b');
  assert.equal(records.find((record) => financeRecordActionKey(record) === actionKey), records[1]);
  assert.equal(financeRecordActionKey({ code: 'LEGACY-1' }), 'LEGACY-1');
});

test('separates settled cashflow from due-date forecasts and moves overdue items to the current month', () => {
  const now = new Date(2026, 2, 15, 10);
  const months = buildCashflowMonths([
    { amount: 120, status: 'Recebida', date: '2026-01-02', settledAt: '2026-01-04' },
    { amount: 80, status: 'Pendente', date: '2026-04-10', dueDate: '2026-05-03' },
    { amount: 35, status: 'Atrasada', date: '2026-02-01', dueDate: '2026-02-20' },
    { amount: 900, status: 'Cancelada', date: '2026-03-01', dueDate: '2026-03-10' },
  ], [
    { amount: 50, status: 'Paga', date: '2026-02-10', settledAt: '2026-02-12' },
    { amount: 25, status: 'Pendente', date: '2026-03-02', dueDate: '2026-04-01' },
  ], now);

  const month = (index) => months.find((item) => item.month.getMonth() === index);
  assert.equal(month(0).incomeRealized, 120);
  assert.equal(month(4).incomeForecast, 80);
  assert.equal(month(2).incomeForecast, 35);
  assert.equal(month(2).incomeRealized, 0);
  assert.equal(month(1).expenseRealized, 50);
  assert.equal(month(3).expenseForecast, 25);
  assert.equal(months.length, 6);
});

test('places date-only values in the intended month in the local timezone', () => {
  const months = buildCashflowMonths([{ amount: 10, status: 'Recebida', date: '2026-01-01' }], [], new Date(2026, 2, 15));
  assert.equal(months.find((item) => item.month.getMonth() === 0).incomeRealized, 10);
});

test('classifies past-due pending income and expenses as overdue without changing stored status', () => {
  const today = new Date(2026, 2, 15, 10);
  assert.equal(isFinanceRecordOverdue({ status: 'Pendente', dueDate: '2026-03-14' }, today), true);
  assert.equal(isFinanceRecordOverdue({ status: 'Recebida', dueDate: '2026-03-14' }, today), false);
  assert.equal(isFinanceRecordOverdue({ status: 'Pendente', dueDate: '2026-03-15' }, today), false);
  assert.equal(isFinanceRecordOverdue({ status: 'Pendente' }, today), false);
});

test('excludes Mercado Pago and localized settled or canceled statuses from receivables', () => {
  assert.equal(isFinanceReceivableOpen({ status: 'paid' }), false);
  assert.equal(isFinanceReceivableOpen({ status: 'cancelled' }), false);
  assert.equal(isFinanceReceivableOpen({ status: 'refunded' }), false);
  assert.equal(isFinanceReceivableOpen({ status: 'Recebida' }), false);
  assert.equal(isFinanceReceivableOpen({ status: 'Paga' }), false);
  assert.equal(isFinanceReceivableOpen({ status: 'pending' }), true);
  assert.equal(isFinanceReceivableOpen({ status: 'Aguardando pagamento' }), true);
});

test('filters finance records by category and due month, falling back to transaction date', () => {
  const records = [
    { id: 'march', category: 'Hospedagem', dueDate: '2026-03-19', date: '2026-02-28' },
    { id: 'february', category: 'Hospedagem', dueDate: '2026-02-19' },
    { id: 'no-category', date: '2026-03-03' },
    { id: 'next-year', category: 'Hospedagem', date: '2027-01-05' },
  ];
  const today = new Date(2026, 2, 15);
  assert.deepEqual(filterFinanceRecords(records, { category: 'Hospedagem', period: 'Este mês', today }).map((item) => item.id), ['march']);
  assert.deepEqual(filterFinanceRecords(records, { category: 'Todos', period: 'Mês passado', today }).map((item) => item.id), ['february']);
  assert.deepEqual(filterFinanceRecords(records, { category: 'Sem categoria', period: 'Este mês', today }).map((item) => item.id), ['no-category']);
  assert.deepEqual(filterFinanceRecords(records, { category: 'Todos', period: 'Este ano', today }).map((item) => item.id), ['march', 'february', 'no-category']);
});

test('filters finance records by canonical client ID, including legacy link fields', () => {
  const records = [
    { id: 'client', clientId: '42', date: '2026-03-01' },
    { id: 'workspace-client', workspaceClientId: 42, date: '2026-03-02' },
    { id: 'unlinked', counterparty: 'Empresa antiga', date: '2026-03-03' },
  ];
  assert.deepEqual(filterFinanceRecords(records, { clientId: '42' }).map((item) => item.id), ['client', 'workspace-client']);
  assert.deepEqual(filterFinanceRecords(records, { clientId: '' }).map((item) => item.id), ['unlinked']);
});

test('exports finance records as spreadsheet-safe semicolon CSV', () => {
  const csv = financeRecordsCsv([{ description: '=HYPERLINK("bad")', counterparty: 'Cliente; Norte', category: 'Sites', date: '2026-03-02', amount: 125.5, status: 'Pendente' }]);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Cliente; Norte"/);
  assert.match(csv, /"125\.5"/);
});
