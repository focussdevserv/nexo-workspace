import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteFinanceAccountTransaction } from './finance-transaction-actions.js';

test('allows deletion of a persisted standalone account movement', () => {
  assert.equal(canDeleteFinanceAccountTransaction({ id: 'movement-1', direction: 'Entrada' }), true);
});

test('keeps paired transfer movements protected from one-sided deletion', () => {
  assert.equal(canDeleteFinanceAccountTransaction({ id: 'movement-2', transferId: 'transfer-1' }), false);
});

test('does not expose deletion for an unsaved movement without an id', () => {
  assert.equal(canDeleteFinanceAccountTransaction({ direction: 'Saída' }), false);
});
