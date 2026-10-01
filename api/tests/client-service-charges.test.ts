import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClientServiceCharges } from '../src/integrations/client-service-charges.js';

test('accepts separate no-charge, fixed, installment, and recurring services', () => {
  assert.equal(validateClientServiceCharges([
    { serviceId: 'one', service: 'Care', billingMode: 'none', amount: null },
    { serviceId: 'two', service: 'Landing page', billingMode: 'single', amount: 2400 },
    { serviceId: 'three', service: 'Branding', billingMode: 'installments', amount: 3600, installments: 3 },
    { serviceId: 'four', service: 'Support', billingMode: 'recurring', amount: 550, frequency: 'months:1' },
  ]), null);
});

test('rejects incomplete paid services and duplicate service links', () => {
  assert.match(validateClientServiceCharges([{ service: 'Support', billingMode: 'recurring', amount: 0, frequency: 'months:1' }]) || '', /valor valido/);
  assert.match(validateClientServiceCharges([{ serviceId: 'same', service: 'A', billingMode: 'none' }, { serviceId: 'same', service: 'B', billingMode: 'none' }]) || '', /duas vezes/);
  assert.match(validateClientServiceCharges([{ service: 'Campaign', billingMode: 'installments', amount: 100, installments: 1 }]) || '', /2 a 24/);
});
