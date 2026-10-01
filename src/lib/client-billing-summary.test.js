import test from 'node:test';
import assert from 'node:assert/strict';
import { clientMonthlyRevenue, clientMonthlyRevenueLabel, parseDisplayAmount, recurringMonthlyAmount } from './client-billing-summary.js';

test('parses Brazilian and dot-decimal currency without multiplying by one hundred', () => {
  assert.equal(parseDisplayAmount('R$ 350.00'), 350);
  assert.equal(parseDisplayAmount(123.45), 123.45);
  assert.equal(parseDisplayAmount('R$ 4.500,75'), 4500.75);
  assert.equal(parseDisplayAmount('R$ 4,500.75'), 4500.75);
  assert.equal(parseDisplayAmount('R$ 35.000'), 35000);
});

test('converts recurring frequencies to monthly revenue and ignores one-time charges', () => {
  assert.equal(recurringMonthlyAmount({ billingMode: 'recurring', amount: 350, frequency: 'months:1' }), 350);
  assert.equal(recurringMonthlyAmount({ billingMode: 'recurring', amount: 1200, frequency: 'months:12' }), 100);
  assert.equal(recurringMonthlyAmount({ billingMode: 'recurring', amount: 700, frequency: 'days:7' }), 3000);
  assert.equal(recurringMonthlyAmount({ billingMode: 'single', amount: 5000 }), 0);
});

test('prefers per-service billing and labels one-time work as non-recurring', () => {
  const client = { value: 'R$ 5.000,00 em cobranças planejadas', serviceCharges: [{ billingMode: 'single', amount: 5000 }] };
  assert.equal(clientMonthlyRevenue(client), 0);
  assert.equal(clientMonthlyRevenueLabel(client), 'Sem recorrência');
  assert.equal(clientMonthlyRevenueLabel({ value: 'R$ 350.00' }), 'R$ 350,00 / mês');
});
