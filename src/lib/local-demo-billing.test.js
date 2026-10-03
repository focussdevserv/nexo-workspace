import assert from 'node:assert/strict';
import test from 'node:test';
import { handleLocalDemoRequest } from './local-demo.js';

const key = 'd6465e54-8e0f-4c75-bcf7-e91655d32a48';

function withDemoStore(store, callback) {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify(store)]]);
  globalThis.localStorage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try { return callback(values); }
  finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalStorage;
  }
}

test('local demo payment orders and subscriptions persist idempotent retries', () => withDemoStore({ 'billing-orders': [], 'billing-subscriptions': [] }, (values) => {
  const order = { clientName: 'Aurora', amount: 180, method: 'pix', dueDate: '2026-11-10' };
  const firstOrder = handleLocalDemoRequest('/api/billing/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(order) });
  const retriedOrder = handleLocalDemoRequest('/api/billing/orders', { method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify({ dueDate: '2026-11-10', method: 'pix', amount: 180, clientName: 'Aurora' }) });
  assert.equal(retriedOrder.data.id, firstOrder.data.id);
  assert.equal(retriedOrder.data.idempotent, true);
  assert.equal(firstOrder.data.dueAt, '2026-11-10T23:59:59-03:00');

  const subscription = { clientName: 'Aurora', amount: 90, frequency: 'months', frequencyInterval: 1 };
  const firstSubscription = handleLocalDemoRequest('/api/billing/subscriptions', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(subscription) });
  const retriedSubscription = handleLocalDemoRequest('/api/billing/subscriptions', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(subscription) });
  assert.equal(retriedSubscription.data.id, firstSubscription.data.id);
  assert.equal(retriedSubscription.data.idempotent, true);

  const saved = JSON.parse(values.get('focusshub.local-demo.v1'));
  assert.equal(saved['billing-orders'].length, 1);
  assert.equal(saved['billing-subscriptions'].length, 1);
  assert.equal(Object.keys(saved.billingCreateAttempts).length, 2, 'same key is isolated by billing operation');
}));

test('local demo payment retries reject a changed payload and malformed idempotency keys', () => withDemoStore({ 'billing-orders': [], 'billing-subscriptions': [] }, () => {
  handleLocalDemoRequest('/api/billing/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ clientName: 'Aurora', amount: 180 }) });
  assert.throws(() => handleLocalDemoRequest('/api/billing/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ clientName: 'Aurora', amount: 181 }) }), /outros dados/i);
  assert.throws(() => handleLocalDemoRequest('/api/billing/orders', { method: 'POST', headers: { 'Idempotency-Key': 'bad-key' }, body: JSON.stringify({ clientName: 'Aurora', amount: 180 }) }), /Idempotency-Key/i);
}));
