import assert from 'node:assert/strict';
import test from 'node:test';
import { sameMercadoPagoPaymentSnapshot } from '../src/integrations/mercadopago.ts';

test('recognizes a repeated Mercado Pago payment snapshot', () => {
  const snapshot = { status: 'paid', statusDetail: 'accredited', paymentId: 'mp-123' };
  assert.equal(sameMercadoPagoPaymentSnapshot(snapshot, { ...snapshot }), true);
  assert.equal(sameMercadoPagoPaymentSnapshot({ status: 'pending' }, { status: 'pending', statusDetail: null, paymentId: null }), true);
});

test('preserves meaningful payment status, detail, and provider ID changes', () => {
  const current = { status: 'pending', statusDetail: 'pending_waiting_transfer', paymentId: null };
  assert.equal(sameMercadoPagoPaymentSnapshot(current, { ...current, status: 'paid' }), false);
  assert.equal(sameMercadoPagoPaymentSnapshot(current, { ...current, statusDetail: 'accredited' }), false);
  assert.equal(sameMercadoPagoPaymentSnapshot(current, { ...current, paymentId: 'mp-123' }), false);
});
