import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentSupportWarning } from './payment-support-warning.js';

test('reports client-list failure without implying that saved payments are unavailable', () => {
  const warning = paymentSupportWarning({ clientError: 'network error' });
  assert.match(warning, /Cobranças carregadas/);
  assert.match(warning, /lista de clientes/);
});

test('combines independent warnings for client list and payment methods', () => {
  const warning = paymentSupportWarning({ clientError: 'network error', methodsError: 'Mercado Pago indisponível.' });
  assert.match(warning, /lista de clientes/);
  assert.match(warning, /configure o Mercado Pago/);
});

test('returns no warning when supporting data loads', () => {
  assert.equal(paymentSupportWarning(), '');
});
