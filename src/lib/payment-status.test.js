import test from 'node:test';
import assert from 'node:assert/strict';
import { canCancelPaymentOrder, canCancelSubscription, normalizePaymentStatus } from './payment-status.js';

test('normalizes provider and localized statuses for consistent actions and labels', () => {
  assert.equal(normalizePaymentStatus(' PENDING '), 'pending');
  assert.equal(normalizePaymentStatus('CANCELLED'), 'canceled');
  assert.equal(normalizePaymentStatus('Aguardando pagamento'), 'pending');
  assert.equal(normalizePaymentStatus('Recebida'), 'paid');
  assert.equal(normalizePaymentStatus('Vencida'), 'overdue');
});

test('allows cancellation only for pending orders accepted by provider or local demo', () => {
  assert.equal(canCancelPaymentOrder({ status: 'PENDING', paymentDetails: { status: 'CREATED' } }), true);
  assert.equal(canCancelPaymentOrder({ status: 'pending', paymentDetails: { status: 'action_required' } }), true);
  assert.equal(canCancelPaymentOrder({ status: 'pending', paymentDetails: { status: 'paid' } }), false);
  assert.equal(canCancelPaymentOrder({ status: 'paid' }, true), false);
  assert.equal(canCancelPaymentOrder({ status: 'pending' }, true), true);
});

test('only active or awaiting subscriptions can be cancelled', () => {
  assert.equal(canCancelSubscription({ status: 'AUTHORIZED' }), true);
  assert.equal(canCancelSubscription({ status: 'Pausada' }), true);
  assert.equal(canCancelSubscription({ status: 'pending' }), true);
  assert.equal(canCancelSubscription({ status: 'cancelled' }), false);
});
