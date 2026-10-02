import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { calculateAccountMovementBalance, canUpdateFinanceAccountBalance, isCurrencyAmount, isCurrencyBalance, reverseAccountMovementBalance } from '../src/integrations/account-ledger.ts';

test('account movements update balances in integer cents for both directions', () => {
  assert.equal(calculateAccountMovementBalance('125.55', 'Saída', 25.1), 100.45);
  assert.equal(calculateAccountMovementBalance(9.99, 'Entrada', 0.01), 10);
  assert.equal(calculateAccountMovementBalance(10, 'Saída', 15), -5);
});

test('account balances accept zero and negative cents but reject precision that would block later movements', () => {
  assert.equal(isCurrencyBalance(0), true);
  assert.equal(isCurrencyBalance(-12.34), true);
  assert.equal(isCurrencyBalance(12.345), false);
  assert.equal(isCurrencyBalance(Number.MAX_SAFE_INTEGER), false);
});

test('account balance edits may preserve the ledger balance but cannot silently overwrite it', () => {
  assert.equal(canUpdateFinanceAccountBalance('125.50', 125.5), true);
  assert.equal(canUpdateFinanceAccountBalance(125.5, 126.5), false);
  assert.equal(canUpdateFinanceAccountBalance(125.5, 'invalid'), false);
});

test('account ledger rejects zero, excess decimal precision, and unsafe balances', () => {
  assert.equal(isCurrencyAmount(12.34), true);
  assert.equal(isCurrencyAmount(12.345), false);
  assert.equal(isCurrencyAmount(0), false);
  assert.throws(() => calculateAccountMovementBalance(10, 'Entrada', 1.001), /finance_amount_invalid_precision/);
  assert.throws(() => calculateAccountMovementBalance(Number.MAX_SAFE_INTEGER / 100, 'Entrada', 1), /finance_balance_overflow/);
});

test('reversing a deleted account movement restores the prior balance in cents', () => {
  assert.equal(reverseAccountMovementBalance(74.9, 'Entrada', 24.9), 50);
  assert.equal(reverseAccountMovementBalance(50, 'Saída', 20.25), 70.25);
  assert.throws(() => reverseAccountMovementBalance(50, 'Transferência', 20), /finance_transaction_direction_invalid/);
});

test('transaction deletion locks the account and reverses standalone entries atomically', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.delete('/api/workspace/:resource/:id'");
  const deletion = source.slice(start, source.indexOf("app.delete('/api/workspace/clients/:id/portal-link'", start));
  assert.match(deletion, /reverseAccountMovementBalance/);
  assert.match(deletion, /finance_transfer_managed/);
  assert.match(deletion, /eq\(workspaceRecords\.id, accountId\)[\s\S]*?\.for\('update'\)/);
  assert.ok(deletion.indexOf("eq(workspaceRecords.resource, 'finance-transactions'), isNull(workspaceRecords.archivedAt),\n      )).returning") < deletion.indexOf('if (accountData && nextBalance !== undefined)'));
});

test('account balance changes through the generic editor are rejected without a ledger entry', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.patch('/api/workspace/:resource/:id'");
  const patchRoute = source.slice(start, source.indexOf("app.delete('/api/workspace/finance-accounts/:id'", start));
  assert.match(patchRoute, /canUpdateFinanceAccountBalance\(current\.data\.balance, body\.data\.balance\)/);
  assert.match(patchRoute, /finance_account_balance_ledger_required/);
  assert.match(patchRoute, /registre uma movimentacao na conta/i);
});
