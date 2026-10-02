import test from 'node:test';
import assert from 'node:assert/strict';
import { financeEntryActionForStatus } from './finance-entry-action.js';

test('legacy and localized open statuses always take the manual settlement path', () => {
  for (const status of [undefined, null, '', 'Pendente', 'pending', 'Aguardando pagamento', 'ABERTA', 'Em atraso', 'Vencida', 'over_due', 'action-required']) {
    assert.equal(financeEntryActionForStatus(status), 'settle', String(status));
  }
});

test('settled and canceled statuses can be removed but unknown statuses are protected', () => {
  for (const status of ['Recebida', 'Paga', 'paid', 'settled', 'Cancelada', 'refunded']) {
    assert.equal(financeEntryActionForStatus(status), 'delete', status);
  }
  assert.equal(financeEntryActionForStatus('Em análise'), 'unsupported');
});
