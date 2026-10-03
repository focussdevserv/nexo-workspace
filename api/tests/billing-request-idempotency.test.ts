import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { billingRequestFingerprint, billingRequestIdempotencyKey, decideBillingIdempotencyReplay } from '../src/billing/request-idempotency.ts';
import { reuseBillingRequestKey } from '../../src/lib/billing-request-idempotency.js';

test('accepts only UUID Idempotency-Key headers and allows legacy callers without one', () => {
  assert.deepEqual(billingRequestIdempotencyKey(undefined), { key: null, valid: true });
  assert.deepEqual(billingRequestIdempotencyKey('F8CF7EE5-C606-4D06-BC3A-3D7097803E18'), { key: 'f8cf7ee5-c606-4d06-bc3a-3d7097803e18', valid: true });
  assert.equal(billingRequestIdempotencyKey('not-a-uuid').valid, false);
  assert.equal(billingRequestIdempotencyKey(['f8cf7ee5-c606-4d06-bc3a-3d7097803e18']).valid, false);
});

test('fingerprints ignore JSON property order while detecting changed billing details', () => {
  assert.equal(billingRequestFingerprint({ amount: 80, payer: { name: 'Ana', email: 'ana@example.com' } }), billingRequestFingerprint({ payer: { email: 'ana@example.com', name: 'Ana' }, amount: 80 }));
  assert.notEqual(billingRequestFingerprint({ amount: 80 }), billingRequestFingerprint({ amount: 81 }));
  assert.equal(billingRequestFingerprint({ amount: 80, cardToken: 'token-a' }), billingRequestFingerprint({ amount: 80, cardToken: 'token-b' }));
});

test('frontend card retry and backend replay agree when Mercado Pago re-tokenizes the same charge', () => {
  const charge = { amount: 80, clientName: 'Ana', payerEmail: 'ana@example.com', method: 'credit_card', cardToken: 'token-a' };
  const firstAttempt = reuseBillingRequestKey(null, 'orders', charge, () => 'request-key');
  const retriedCharge = { ...charge, cardToken: 'token-b' };
  const retryAttempt = reuseBillingRequestKey(firstAttempt, 'orders', retriedCharge, () => 'new-request-key');
  assert.equal(retryAttempt.key, firstAttempt.key);
  assert.equal(billingRequestFingerprint(charge), billingRequestFingerprint(retriedCharge));
  assert.equal(decideBillingIdempotencyReplay(billingRequestFingerprint(charge), billingRequestFingerprint(retriedCharge), 'failed'), 'retry');

  for (const changed of [
    { ...retriedCharge, amount: 81 },
    { ...retriedCharge, clientName: 'Outra pessoa' },
    { ...retriedCharge, method: 'debit_card' },
  ]) {
    assert.notEqual(reuseBillingRequestKey(firstAttempt, 'orders', changed, () => 'changed-payload-key').key, firstAttempt.key);
    assert.equal(decideBillingIdempotencyReplay(billingRequestFingerprint(charge), billingRequestFingerprint(changed), 'failed'), 'conflict');
  }
});

test('replays completed operations, retries failed operations, and blocks conflicts or concurrent creation', () => {
  const hash = billingRequestFingerprint({ amount: 80 });
  assert.equal(decideBillingIdempotencyReplay(hash, hash, 'completed'), 'replay');
  assert.equal(decideBillingIdempotencyReplay(hash, hash, 'failed'), 'retry');
  assert.equal(decideBillingIdempotencyReplay(hash, hash, 'creating'), 'in_progress');
  assert.equal(decideBillingIdempotencyReplay(hash, billingRequestFingerprint({ amount: 81 }), 'failed'), 'conflict');
});

test('charge and subscription routes persist scoped idempotency and reserve retries under a database lock', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const charge = source.slice(source.indexOf("app.post('/api/billing/orders'"), source.indexOf("app.post('/api/billing/orders/:id/cancel'"));
  const subscription = source.slice(source.indexOf("app.post('/api/billing/subscriptions'"), source.indexOf("app.patch('/api/billing/subscriptions/:id/status'"));
  for (const route of [charge, subscription]) {
    assert.match(route, /billingRequestIdempotencyKey\(request\.headers\['idempotency-key'\]\)/);
    assert.match(route, /billingRequestFingerprint\(body\)/);
    assert.match(route, /pg_advisory_xact_lock/);
    assert.match(route, /requestIdempotencyKey/);
    assert.match(route, /requestHash/);
    assert.match(route, /decideBillingIdempotencyReplay/);
  }
});

test('billing idempotency columns are added incrementally and uniquely scoped by organization', async () => {
  const migration = await readFile(new URL('../drizzle/0011_billing_request_idempotency.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  assert.match(migration, /ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS request_idempotency_key text/);
  assert.match(migration, /ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS request_idempotency_key text/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS billing_orders_org_request_key_unique\s+ON billing_orders \(organization_id, request_idempotency_key\)/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS billing_subscriptions_org_request_key_unique\s+ON billing_subscriptions \(organization_id, request_idempotency_key\)/);
  assert.ok(journal.entries.some((entry) => entry.idx === 11 && entry.tag === '0011_billing_request_idempotency'));
});
