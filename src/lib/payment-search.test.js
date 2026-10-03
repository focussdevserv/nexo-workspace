import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPaymentSearch } from './payment-search.js';

test('payment search matches Portuguese names and descriptions without requiring accents', () => {
  const item = { clientName: 'João Silva', description: 'Consultoria financeira', status: 'Aguardando pagamento' };

  assert.equal(matchesPaymentSearch(item, 'joao'), true);
  assert.equal(matchesPaymentSearch(item, 'financeira'), true);
  assert.equal(matchesPaymentSearch(item, 'aguardando pagamento'), true);
  assert.equal(matchesPaymentSearch(item, 'construcao'), false);
});

test('payment search includes payer email and payment method, and ignores an empty query', () => {
  const item = { payerEmail: 'financeiro@empresa.com', method: 'Cartão de crédito' };

  assert.equal(matchesPaymentSearch(item, 'EMPRESA.COM'), true);
  assert.equal(matchesPaymentSearch(item, 'cartao de credito'), true);
  assert.equal(matchesPaymentSearch(item, '   '), true);
});
