import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { confirmsSubscriptionStatus } from '../src/billing/subscription-provider-confirmation.js';

test('accepts only provider responses confirming the requested subscription state', () => {
  assert.equal(confirmsSubscriptionStatus({ status: 'paused' }, 'paused'), true);
  assert.equal(confirmsSubscriptionStatus({ status: 'authorized' }, 'authorized'), true);
  assert.equal(confirmsSubscriptionStatus({ status: 'cancelled' }, 'canceled'), true);
  assert.equal(confirmsSubscriptionStatus({ status: 'authorized' }, 'paused'), false);
  assert.equal(confirmsSubscriptionStatus({ status: 'pending' }, 'canceled'), false);
});

test('rejects missing, malformed, or unknown provider status responses', () => {
  assert.equal(confirmsSubscriptionStatus(null, 'paused'), false);
  assert.equal(confirmsSubscriptionStatus({}, 'paused'), false);
  assert.equal(confirmsSubscriptionStatus({ status: 'in_process' }, 'authorized'), false);
  assert.equal(confirmsSubscriptionStatus('paused', 'paused'), false);
});

test('subscription API refuses to persist a state the provider did not confirm', async () => {
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = server.indexOf("app.patch('/api/billing/subscriptions/:id/status'");
  const end = server.indexOf("app.post('/api/integrations/mercadopago/webhook'", start);
  const route = server.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const confirmation = route.indexOf('if (!confirmsSubscriptionStatus(providerUpdate, body.status))');
  const persistence = route.indexOf('db.update(billingSubscriptions).set({ status: body.status');
  assert.ok(confirmation >= 0 && persistence > confirmation);
  assert.match(route, /subscription_status_unconfirmed/);
});
