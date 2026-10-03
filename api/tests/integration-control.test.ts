import assert from 'node:assert/strict';
import test from 'node:test';
import { integrationControlAllowsUse, oauthProviderHasSavedAccount } from '../src/integrations/integration-control.js';

test('integration use is allowed by default and can be explicitly paused', () => {
  assert.equal(integrationControlAllowsUse(undefined), true);
  assert.equal(integrationControlAllowsUse(null), true);
  assert.equal(integrationControlAllowsUse({}), true);
  assert.equal(integrationControlAllowsUse({ enabled: true }), true);
  assert.equal(integrationControlAllowsUse({ enabled: false }), false);
});

test('OAuth app credentials do not count as linked Google or Mercado Pago accounts', () => {
  assert.equal(oauthProviderHasSavedAccount('google', { email: '' }), false);
  assert.equal(oauthProviderHasSavedAccount('google', { email: '  ' }), false);
  assert.equal(oauthProviderHasSavedAccount('google', { email: 'owner@example.com' }), true);
  assert.equal(oauthProviderHasSavedAccount('mercadopago', { legacyAccount: false }), false);
  assert.equal(oauthProviderHasSavedAccount('mercadopago', { accountId: 'seller-42' }), true);
  assert.equal(oauthProviderHasSavedAccount('mercadopago', { legacyAccount: true }), true);
});
