import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesMercadoPagoExternalReference, mercadoPagoAccountMatchesRecord, mercadoPagoWebhookResource } from '../src/integrations/mercadopago-webhook.js';

test('webhook topics are paired only with their documented local resource lookups', () => {
  assert.equal(mercadoPagoWebhookResource('order'), 'order');
  assert.equal(mercadoPagoWebhookResource('subscription_preapproval'), 'subscription');
  assert.equal(mercadoPagoWebhookResource('merchant_order'), null);
  assert.equal(mercadoPagoWebhookResource('payment'), null);
});

test('provider external references must exactly match the local billing record', () => {
  assert.equal(matchesMercadoPagoExternalReference('local-order-id', 'local-order-id'), true);
  assert.equal(matchesMercadoPagoExternalReference('another-workspace-order', 'local-order-id'), false);
  assert.equal(matchesMercadoPagoExternalReference(undefined, 'local-order-id'), false);
});

test('billing records cannot switch to a different Mercado Pago seller account', () => {
  assert.equal(mercadoPagoAccountMatchesRecord('seller-a', 'seller-a', false), true);
  assert.equal(mercadoPagoAccountMatchesRecord('seller-a', 'seller-b', false), false);
  assert.equal(mercadoPagoAccountMatchesRecord(null, 'seller-b', false), false);
  assert.equal(mercadoPagoAccountMatchesRecord(null, null, true), true);
  assert.equal(mercadoPagoAccountMatchesRecord(null, null, false), false);
});
