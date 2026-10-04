import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentCancellationError, subscriptionCancellationError, subscriptionStatusChangeError } from './payment-cancellation.js';
import { handleLocalDemoRequest } from './local-demo.js';

test('accepts an already-cancelled provider result, including legacy Portuguese status', () => {
  assert.equal(paymentCancellationError({ data: { id: 'order-1', status: 'cancelled' } }, 'order-1'), '');
  assert.equal(paymentCancellationError({ data: { id: 'order-1', status: 'Cancelada' }, alreadyCanceled: true }, 'order-1'), '');
});

test('payment cancellation requires the selected record ID when supplied', () => {
  assert.match(paymentCancellationError({ data: { id: 'other-order', status: 'canceled' } }, 'order-1'), /n\u00e3o foi confirmado para esta cobran/);
  assert.match(paymentCancellationError({ data: { status: 'canceled' } }, 'order-1'), /n\u00e3o foi confirmado para esta cobran/);
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

test('subscription pause and resume require the expected record and returned status', () => {
  assert.equal(subscriptionStatusChangeError({ data: { id: 'sub-1', status: 'paused' } }, 'sub-1', 'paused'), '');
  assert.equal(subscriptionStatusChangeError({ data: { id: 'sub-1', status: 'authorized' } }, 'sub-1', 'authorized'), '');
  assert.match(subscriptionStatusChangeError({ data: { id: 'other', status: 'paused' } }, 'sub-1', 'paused'), /n\u00e3o foi confirmada para este registro/);
  assert.match(subscriptionStatusChangeError({ data: { id: 'sub-1', status: 'authorized' } }, 'sub-1', 'paused'), /novo status.*n\u00e3o foi confirmado/);
  assert.match(subscriptionStatusChangeError({ data: null }, 'sub-1', 'paused'), /n\u00e3o foi confirmada para este registro/);
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

test('payment cancellation UI validates the returned record against the selected payment', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const cancelOrder = async (item) =>');
  const end = source.indexOf('const refreshOrder = async (item) =>', start);
  assert.ok(start >= 0 && end > start);
  const action = source.slice(start, end);
  assert.match(action, /paymentCancellationError\(response, item\.id\)/);
  assert.ok(action.indexOf('if (cancellationError) throw new Error(cancellationError)') < action.indexOf("notify(demoMode ? 'Cobrança fictícia cancelada"));
});

test('subscription pause, resume, and demo authorization validate the server result before refresh or success notice', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  const toggleStart = source.indexOf('const toggleSubscription = async (item) =>');
  const simulateStart = source.indexOf('const simulateSubscriptionAuthorization = async (item) =>', toggleStart);
  const cancelStart = source.indexOf('const cancelOrder = async (item) =>', simulateStart);
  assert.ok(toggleStart >= 0 && simulateStart > toggleStart && cancelStart > simulateStart);
  const toggle = source.slice(toggleStart, simulateStart);
  const simulate = source.slice(simulateStart, cancelStart);
  for (const action of [toggle, simulate]) {
    assert.match(action, /subscriptionStatusChangeError\(response, item\.id,/);
    assert.ok(action.indexOf('if (statusChangeError) throw new Error(statusChangeError)') < action.indexOf('await refresh()'));
  }
  assert.match(toggle, /notify\(status === 'paused' \? 'Assinatura pausada\.' : 'Assinatura retomada\.'\)/);
  assert.match(simulate, /notify\('Autoriza[\w\W]*?Nenhum pagamento real foi iniciado\.'/);
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
    assert.equal(paymentCancellationError(canceled, 'demo-open'), '');
    const declined = handleLocalDemoRequest('/api/billing/orders/demo-paid/cancel', { method: 'POST' });
    assert.match(paymentCancellationError(declined, 'demo-paid'), /Apenas cobranças fictícias/);
    assert.equal(JSON.parse(values.get('focusshub.local-demo.v1'))['billing-orders'][1].status, 'paid');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});

test('local demo pause and resume return the matching subscription ID and status for confirmation', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({ 'billing-subscriptions': [
    { id: 'demo-subscription', status: 'authorized' },
  ] })]]);
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try {
    const paused = handleLocalDemoRequest('/api/billing/subscriptions/demo-subscription/status', { method: 'PATCH', body: JSON.stringify({ status: 'paused' }) });
    assert.equal(subscriptionStatusChangeError(paused, 'demo-subscription', 'paused'), '');
    const resumed = handleLocalDemoRequest('/api/billing/subscriptions/demo-subscription/status', { method: 'PATCH', body: JSON.stringify({ status: 'authorized' }) });
    assert.equal(subscriptionStatusChangeError(resumed, 'demo-subscription', 'authorized'), '');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
