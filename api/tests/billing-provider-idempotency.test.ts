import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { billingProviderIdempotencyKey } from '../src/billing/provider-idempotency.ts';

test('provider idempotency keys are stable per persisted operation and unique across operations', () => {
  const id = 'f8cf7ee5-c606-4d06-bc3a-3d7097803e18';
  const create = billingProviderIdempotencyKey('order-create', id);
  assert.equal(create, billingProviderIdempotencyKey('order-create', id));
  assert.match(create, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(create, billingProviderIdempotencyKey('order-cancel', id));
  assert.notEqual(create, billingProviderIdempotencyKey('subscription-create', id));
  assert.notEqual(create, billingProviderIdempotencyKey('order-create', '80cf7ee5-c606-4d06-bc3a-3d7097803e18'));
});

test('billing provider create and cancellation routes derive idempotency from their persisted records', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf("app.post('/api/billing/orders'"), source.indexOf("app.post('/api/billing/orders/:id/cancel'"));
  const cancel = source.slice(source.indexOf("app.post('/api/billing/orders/:id/cancel'"), source.indexOf("app.post('/api/billing/orders/:id/refresh'"));
  const subscription = source.slice(source.indexOf("app.post('/api/billing/subscriptions'"), source.indexOf("app.patch('/api/billing/subscriptions/:id/status'"));

  assert.match(create, /billingProviderIdempotencyKey\('order-create', invoice!?\.id\)/);
  assert.match(cancel, /billingProviderIdempotencyKey\('order-cancel', order\.id\)/);
  assert.match(subscription, /billingProviderIdempotencyKey\('subscription-create', subscription!?\.id\)/);
  assert.doesNotMatch(`${create}${cancel}${subscription}`, /X-Idempotency-Key': randomUUID\(\)/);
});
