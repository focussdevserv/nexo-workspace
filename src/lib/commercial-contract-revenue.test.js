import test from 'node:test';
import assert from 'node:assert/strict';
import { activeContractMonthlyRevenue } from './commercial-contract-revenue.js';

test('contract revenue metric counts only active or signed recurring contracts', () => {
  assert.equal(activeContractMonthlyRevenue([
    { status: 'Ativo', paymentTerms: 'Mensal recorrente', value: 'R$ 1.200,00' },
    { status: 'Assinado', paymentTerms: 'Mensal recorrente', value: 'R$ 600,00', frequency: 'months', frequencyInterval: 2 },
    { status: 'Cancelado', paymentTerms: 'Mensal recorrente', value: 'R$ 900,00' },
    { status: 'Rascunho', paymentTerms: 'Mensal recorrente', value: 'R$ 500,00' },
    { status: 'Ativo', paymentTerms: 'Pagamento único', value: 'R$ 5.000,00' },
  ]), 1500);
});
