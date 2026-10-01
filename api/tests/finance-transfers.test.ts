import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinanceTransferBalances } from '../src/integrations/finance-transfers.ts';

test('calculates both transfer balances in integer cents', () => {
  assert.deepEqual(calculateFinanceTransferBalances(125.55, 9.99, 20.10), {
    sourceBalance: 105.45,
    destinationBalance: 30.09,
    amount: 20.1,
  });
});

test('rejects zero, excess precision, and transfers over the source balance', () => {
  assert.throws(() => calculateFinanceTransferBalances(100, 0, 0), /finance_transfer_invalid_amount/);
  assert.throws(() => calculateFinanceTransferBalances(100, 0, 1.001), /finance_transfer_invalid_amount/);
  assert.throws(() => calculateFinanceTransferBalances(9.99, 0, 10), /finance_transfer_insufficient_funds/);
});

test('rejects a destination balance that cannot be represented safely', () => {
  assert.throws(() => calculateFinanceTransferBalances(100, Number.MAX_SAFE_INTEGER / 100, 1), /finance_transfer_balance_overflow/);
});
