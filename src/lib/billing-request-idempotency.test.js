import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { billingPayloadFingerprint, createBillingRequestUuid, reuseBillingRequestKey } from './billing-request-idempotency.js';

test('a billing retry reuses its request key for an identical semantic payload', () => {
  const first = reuseBillingRequestKey(null, 'orders', { amount: 40, payer: { name: 'Ana' } }, () => 'key-1');
  const retry = reuseBillingRequestKey(first, 'orders', { payer: { name: 'Ana' }, amount: 40 }, () => 'key-2');
  assert.equal(retry.key, 'key-1');
});

test('a changed payload or billing operation receives a new request key', () => {
  const first = reuseBillingRequestKey(null, 'orders', { amount: 40 }, () => 'key-1');
  assert.equal(reuseBillingRequestKey(first, 'orders', { amount: 41 }, () => 'key-2').key, 'key-2');
  assert.equal(reuseBillingRequestKey(first, 'subscriptions', { amount: 40 }, () => 'key-3').key, 'key-3');
});

test('ephemeral card tokens do not turn a retry of the same charge into a new request', () => {
  assert.equal(billingPayloadFingerprint('orders', { amount: 80, cardToken: 'token-a' }), billingPayloadFingerprint('orders', { amount: 80, cardToken: 'token-b' }));
});

test('billing request UUID fallback stays valid when crypto.randomUUID is unavailable', () => {
  const previous = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try { assert.match(createBillingRequestUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); }
  finally { Object.defineProperty(globalThis, 'crypto', { configurable: true, value: previous }); }
});

test('payment create forms send and retain an Idempotency-Key until successful creation', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /reuseBillingRequestKey/);
  assert.match(source, /['"]Idempotency-Key['"]\s*:/);
  assert.match(source, /billingRequestAttempt\.current\s*=\s*null/);
});

test('client profile charge and subscription retries reuse an idempotency key until the API confirms creation', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const save = source.slice(source.indexOf('const saveClientFinance = async event =>'), source.indexOf('const addClientFile = async file =>'));
  assert.match(source, /import \{ createBillingRequestUuid, reuseBillingRequestKey \} from ["']\.\.\/lib\/billing-request-idempotency\.js["']/);
  assert.match(save, /billingRequestAttempt\.current = reuseBillingRequestKey\(/);
  assert.match(save, /operation,\s*payload,\s*createBillingRequestUuid/);
  assert.match(save, /headers:\s*\{\s*["']Idempotency-Key["']:\s*idempotencyKey\s*\}/);

  const requestIndex = save.indexOf('const result = await apiRequest(endpoint, {');
  const clearIndex = save.indexOf('if (!financeRecord) billingRequestAttempt.current = null;', requestIndex);
  const catchIndex = save.indexOf('} catch (error) {', requestIndex);
  assert.ok(requestIndex >= 0, 'client finance create request is present');
  assert.ok(clearIndex > requestIndex && clearIndex < catchIndex, 'key is cleared only after the create request resolves');
  assert.doesNotMatch(save.slice(catchIndex), /billingRequestAttempt\.current\s*=\s*null/);
});
