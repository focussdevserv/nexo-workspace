import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCreateContext } from './dashboard-create-context.js';

test('Meu Dia creates lead and billing contexts understood by their destination modules', () => {
  assert.deepEqual(dashboardCreateContext('lead', 'lead-intent'), { quickCreate: 'lead', intentId: 'lead-intent' });
  assert.deepEqual(dashboardCreateContext('billing', 'billing-intent'), { action: 'create', intentId: 'billing-intent' });
});

test('Meu Dia does not create a context for unsupported actions or missing intent ids', () => {
  assert.equal(dashboardCreateContext('unknown', 'intent'), null);
  assert.equal(dashboardCreateContext('lead', ''), null);
});
