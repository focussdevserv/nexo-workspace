import test from 'node:test';
import assert from 'node:assert/strict';
import { splitInstallmentAmounts } from './installment-plan.js';

test('splits cents evenly and distributes remainder to earliest installments', () => {
  const amounts = splitInstallmentAmounts(100, 3);
  assert.deepEqual(amounts, [33.34, 33.33, 33.33]);
  assert.equal(Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100), 10000);
});

test('rejects invalid installment totals and counts', () => {
  assert.deepEqual(splitInstallmentAmounts(0, 3), []);
  assert.deepEqual(splitInstallmentAmounts(10, 1), []);
  assert.deepEqual(splitInstallmentAmounts(10, 25), []);
});
