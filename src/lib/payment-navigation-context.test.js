import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentNavigationContextKey } from './payment-navigation-context.js';

test('billing navigation key changes when any CRM prefill value changes', () => {
  const context = {
    intentId: 'same-intent', action: 'create', clientId: 'client-1', clientName: 'Cliente',
    clientEmail: 'client@example.test', description: 'Serviço', amount: 120,
    frequency: 'months', frequencyInterval: 1, installmentServiceId: 'service-1',
    installmentIndex: 0, installmentCount: 3,
  };
  const original = paymentNavigationContextKey(context);
  const prefilledFields = [
    'clientId', 'clientName', 'clientEmail', 'description', 'amount', 'frequency',
    'frequencyInterval', 'installmentServiceId', 'installmentIndex', 'installmentCount',
  ];

  for (const field of prefilledFields) {
    const changed = { ...context, [field]: field === 'amount' || field === 'frequencyInterval' || field === 'installmentIndex' || field === 'installmentCount' ? 999 : `changed-${field}` };
    assert.notEqual(paymentNavigationContextKey(changed), original, `${field} must retrigger billing prefill`);
  }
});

test('billing navigation key tracks overdue filters and distinguishes an empty context', () => {
  assert.equal(paymentNavigationContextKey(null), '');
  assert.notEqual(paymentNavigationContextKey({ filter: 'overdue' }), paymentNavigationContextKey({}));
});
