import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { automationDeliveryActionUrl, automationDeliveryActions } from './automation-delivery-actions.js';

const id = 'overdue:7c744b6a-fdc2-49c5-a14a-9f9d126eb8af';

test('offers discard for pending overdue deliveries and retry only after backend eligibility', () => {
  assert.deepEqual(automationDeliveryActions({ deliveryType: 'billing_overdue', status: 'pending', retryable: false }), [
    { action: 'discard', label: 'Ignorar cobrança' },
  ]);
  assert.deepEqual(automationDeliveryActions({ deliveryType: 'billing_overdue', status: 'discarded', retryable: true }), [
    { action: 'retry', label: 'Reprocessar cobrança' },
  ]);
  assert.deepEqual(automationDeliveryActions({ deliveryType: 'billing_overdue', status: 'delivered', retryable: false }), []);
  assert.deepEqual(automationDeliveryActions({ deliveryType: 'billing_overdue', status: 'pending', retryable: true }), [
    { action: 'discard', label: 'Ignorar cobrança' },
  ]);
});

test('retains namespaced overdue ids and URL-encodes them for the backend action route', () => {
  assert.equal(automationDeliveryActionUrl(id, 'retry'), `/api/integrations/n8n/deliveries/${encodeURIComponent(id)}/retry`);
  assert.equal(automationDeliveryActionUrl(id, 'discard'), `/api/integrations/n8n/deliveries/${encodeURIComponent(id)}/discard`);
  assert.equal(automationDeliveryActionUrl(id, 'retry'), '/api/integrations/n8n/deliveries/overdue%3A7c744b6a-fdc2-49c5-a14a-9f9d126eb8af/retry');
});

test('keeps ordinary n8n delivery actions compatible with the same route', () => {
  const ordinaryId = '7c744b6a-fdc2-49c5-a14a-9f9d126eb8af';
  assert.deepEqual(automationDeliveryActions({ deliveryType: 'n8n', status: 'discarded', retryable: true }), [
    { action: 'retry', label: 'Reprocessar' },
  ]);
  assert.equal(automationDeliveryActionUrl(ordinaryId, 'retry'), `/api/integrations/n8n/deliveries/${ordinaryId}/retry`);
});

test('rejects unsupported delivery actions', () => {
  assert.throws(() => automationDeliveryActionUrl(id, 'publish'), /inválida/);
});

test('automation history renders the shared action policy and calls the namespaced delivery endpoint', async () => {
  const screen = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  assert.match(screen, /automationDeliveryActions\(delivery\)/);
  assert.match(screen, /automationDeliveryActionUrl\(delivery\.id, action\)/);
  assert.match(screen, /delivery\.deliveryType === 'billing_overdue'/);
  assert.match(screen, /onOperate=\{operateDelivery\}/);
});
