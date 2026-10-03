import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentFrequencyLabel } from './payment-frequency.js';

test('labels weekly and monthly billing cycles clearly', () => {
  assert.equal(paymentFrequencyLabel('days', 7), 'Semanal');
  assert.equal(paymentFrequencyLabel('months', 1), 'Mensal');
  assert.equal(paymentFrequencyLabel('months', 3), 'Trimestral');
  assert.equal(paymentFrequencyLabel('months', 6), 'Semestral');
  assert.equal(paymentFrequencyLabel('months', 12), 'Anual');
});

test('labels supported custom intervals and handles malformed persisted values', () => {
  assert.equal(paymentFrequencyLabel('days', 14), 'A cada 14 dias');
  assert.equal(paymentFrequencyLabel('months', 2), 'A cada 2 meses');
  assert.equal(paymentFrequencyLabel('unknown', 1), 'Frequência não informada');
  assert.equal(paymentFrequencyLabel('months', 0), 'Frequência não informada');
});
