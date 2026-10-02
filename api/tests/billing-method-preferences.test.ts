import test from 'node:test';
import assert from 'node:assert/strict';
import { billingMethodPreferenceAllows } from '../src/billing/method-preferences.js';

test('missing preferences keep provider methods available by default', () => {
  assert.equal(billingMethodPreferenceAllows('pix', undefined), true);
  assert.equal(billingMethodPreferenceAllows('credit_card', null), true);
});

test('disabled methods are blocked, with one card switch covering credit and debit', () => {
  const preferences = { pix: false, boleto: true, card: false };
  assert.equal(billingMethodPreferenceAllows('pix', preferences), false);
  assert.equal(billingMethodPreferenceAllows('boleto', preferences), true);
  assert.equal(billingMethodPreferenceAllows('credit_card', preferences), false);
  assert.equal(billingMethodPreferenceAllows('debit_card', preferences), false);
});
