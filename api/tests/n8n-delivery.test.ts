import assert from 'node:assert/strict';
import { test } from 'node:test';
import { N8N_DELIVERY_MAX_ATTEMPTS, n8nCallbackRejectionReason, n8nDeliveryExhausted, n8nDeliveryRetryDelayMs } from '../src/integrations/n8n-delivery.js';

test('n8n delivery retries back off and cap at the final interval', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map(n8nDeliveryRetryDelayMs), [30_000, 120_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000, 14_400_000]);
  assert.equal(n8nDeliveryRetryDelayMs(0), 30_000);
});

test('n8n deliveries stop retrying at the configured attempt limit', () => {
  assert.equal(n8nDeliveryExhausted(N8N_DELIVERY_MAX_ATTEMPTS - 1), false);
  assert.equal(n8nDeliveryExhausted(N8N_DELIVERY_MAX_ATTEMPTS), true);
  assert.equal(n8nDeliveryExhausted(N8N_DELIVERY_MAX_ATTEMPTS + 1), true);
});

test('n8n callback honors workspace integration pause before allowing a task action', () => {
  const activeMatchingAutomation = { automationActive: true, automationEventKey: 'lead.created', incomingEventKey: 'lead.created' };
  assert.equal(n8nCallbackRejectionReason({ ...activeMatchingAutomation, integrationEnabled: true }), null);
  assert.equal(n8nCallbackRejectionReason({ ...activeMatchingAutomation, integrationEnabled: false }), 'integration_disconnected');
  assert.equal(n8nCallbackRejectionReason({ ...activeMatchingAutomation, integrationEnabled: true, automationActive: false }), 'automation_not_found');
  assert.equal(n8nCallbackRejectionReason({ ...activeMatchingAutomation, integrationEnabled: true, incomingEventKey: 'ticket.created' }), 'automation_not_found');
});
