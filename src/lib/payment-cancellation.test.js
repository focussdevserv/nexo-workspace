import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentCancellationError, subscriptionCancellationError } from './payment-cancellation.js';
import { handleLocalDemoRequest } from './local-demo.js';

test('accepts an already-cancelled provider result, including legacy Portuguese status', () => {
  assert.equal(paymentCancellationError({ data: { status: 'cancelled' } }), '');
  assert.equal(paymentCancellationError({ data: { status: 'Cancelada' }, alreadyCanceled: true }), '');
});

test('does not report success when local demo declines cancellation or the record is missing', () => {
  assert.match(paymentCancellationError({ status: 'demo_only', message: 'A cobrança não está aberta.', data: { status: 'paid' } }), /não está aberta/);
  assert.match(paymentCancellationError({ status: 'demo_only', data: null }), /não foi confirmado/);
});

test('does not report success for a response that still shows an open payment', () => {
  assert.match(paymentCancellationError({ data: { status: 'pending' } }), /não foi confirmado/);
});

test('subscription cancellation requires the expected ID and a confirmed canceled status', () => {
  assert.equal(subscriptionCancellationError({ data: { id: 'subscription-1', status: 'canceled' } }, 'subscription-1'), '');
  assert.equal(subscriptionCancellationError({ data: { id: 'subscription-1', status: 'Cancelada' } }, 'subscription-1'), '');
  assert.match(subscriptionCancellationError({ data: { id: 'subscription-1', status: 'authorized' } }, 'subscription-1'), /cancelamento da assinatura/);
  assert.match(subscriptionCancellationError({ data: { id: 'subscription-other', status: 'canceled' } }, 'subscription-1'), /cancelamento da assinatura/);
  assert.match(subscriptionCancellationError({ data: null }, 'subscription-1'), /cancelamento da assinatura/);
});

test('subscription cancellation UI only reports success after validating the returned record', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const cancelSubscription = async (item) =>');
  const end = source.indexOf('const toggleSubscription = async (item) =>', start);
  assert.ok(start >= 0 && end > start);
  const action = source.slice(start, end);
  assert.match(action, /const cancellationError = subscriptionCancellationError\(response, item\.id\)/);
  assert.ok(action.indexOf('if (cancellationError) throw new Error(cancellationError)') < action.indexOf("notify('Assinatura cancelada no Mercado Pago.')"));
});

test('local demo cancellation checks the returned state before reporting success', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({ 'billing-orders': [
    { id: 'demo-open', status: 'pending' },
    { id: 'demo-paid', status: 'paid' },
  ] })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try {
    const canceled = handleLocalDemoRequest('/api/billing/orders/demo-open/cancel', { method: 'POST' });
    assert.equal(paymentCancellationError(canceled), '');
    const declined = handleLocalDemoRequest('/api/billing/orders/demo-paid/cancel', { method: 'POST' });
    assert.match(paymentCancellationError(declined), /Apenas cobranças fictícias/);
    assert.equal(JSON.parse(values.get('focusshub.local-demo.v1'))['billing-orders'][1].status, 'paid');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
