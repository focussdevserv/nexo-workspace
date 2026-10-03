import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFinanceAccountTransactions, financeAccountTransactionSignedAmount, normalizeFinanceAccountTransaction } from './finance-account-transactions.js';

test('normalizes older signed movements into the current finance account shape', () => {
  const accounts = [{ id: 'account-1', name: 'Conta operacional' }];
  const row = normalizeFinanceAccountTransaction({ account: 'Conta operacional', amount: -149, description: 'Assinatura' }, accounts);
  assert.equal(row.accountId, 'account-1');
  assert.equal(row.accountName, 'Conta operacional');
  assert.equal(row.direction, 'Saída');
  assert.equal(row.amount, 149);
  assert.equal(financeAccountTransactionSignedAmount(row), -149);
});

test('filters legacy movements by account name when no account ID was saved', () => {
  const accounts = [{ id: 'account-1', name: 'Conta operacional' }, { id: 'account-2', name: 'Reserva' }];
  const rows = [
    { id: 'legacy-match', account: 'Conta operacional', amount: 3200 },
    { id: 'legacy-other', account: 'Reserva', amount: -50 },
    { id: 'current', accountId: 'account-2', accountName: 'Reserva', direction: 'Entrada', amount: 75 },
  ];
  assert.deepEqual(filterFinanceAccountTransactions(rows, 'account-1', accounts).map((row) => row.id), ['legacy-match']);
  assert.deepEqual(filterFinanceAccountTransactions(rows, 'account-2', accounts).map((row) => row.id), ['legacy-other', 'current']);
});

test('does not mix transactions between accounts with the same display name', () => {
  const accounts = [{ id: 'account-1', name: 'Conta principal' }, { id: 'account-2', name: 'Conta principal' }];
  const rows = [
    { id: 'first', accountId: 'account-1', accountName: 'Conta principal', amount: 100 },
    { id: 'second', accountId: 'account-2', accountName: 'Conta principal', amount: 200 },
    { id: 'ambiguous-legacy', account: 'Conta principal', amount: 300 },
  ];

  assert.deepEqual(filterFinanceAccountTransactions(rows, 'account-1', accounts).map((row) => row.id), ['first']);
  assert.deepEqual(filterFinanceAccountTransactions(rows, 'account-2', accounts).map((row) => row.id), ['second']);
  assert.equal(normalizeFinanceAccountTransaction(rows[2], accounts).accountId, '');
  assert.deepEqual(filterFinanceAccountTransactions([rows[2]], 'account-1', accounts), []);
});

test('does not silently relink a stale account ID to another account with the same name', () => {
  const accounts = [{ id: 'new-account', name: 'Conta principal' }];
  const row = { id: 'stale-link', accountId: 'archived-account', accountName: 'Conta principal', amount: 50 };

  assert.equal(normalizeFinanceAccountTransaction(row, accounts).accountId, 'archived-account');
  assert.deepEqual(filterFinanceAccountTransactions([row], 'new-account', accounts), []);
});

test('preserves explicit movement direction and absolute value', () => {
  const row = normalizeFinanceAccountTransaction({ direction: 'Entrada', amount: -25 });
  assert.equal(row.direction, 'Entrada');
  assert.equal(financeAccountTransactionSignedAmount(row), 25);
});
