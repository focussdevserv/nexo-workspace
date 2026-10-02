import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBrowserNotificationPreferences, notificationAccessPath, resolveActivityNotificationTitle } from '../src/notifications.js';

test('notifies when a proposal is accepted and a contract is generated', () => {
  assert.equal(resolveActivityNotificationTitle('proposals', 'accepted'), 'Proposta aceita');
  assert.equal(resolveActivityNotificationTitle('contracts', 'created_from_accepted_proposal'), 'Contrato criado após proposta aceita');
});

test('notifies when a contract is sent for signature or its provider status changes', () => {
  assert.equal(resolveActivityNotificationTitle('contracts', 'signature_requested'), 'Contrato enviado para assinatura');
  assert.equal(resolveActivityNotificationTitle('contracts', 'signature_status_synced'), 'Status de assinatura atualizado');
});

test('keeps unsupported entity actions out of the notification feed', () => {
  assert.equal(resolveActivityNotificationTitle('contracts', 'archived'), null);
  assert.equal(resolveActivityNotificationTitle('unknown', 'created'), null);
});

test('shows the specific payment title after a Mercado Pago status update', () => {
  assert.equal(resolveActivityNotificationTitle('billing_order', 'provider_updated'), 'Pagamento atualizado');
  assert.equal(resolveActivityNotificationTitle('billing_subscription', 'updated'), 'Assinatura atualizada');
});

test('maps notifications to the same protected resource as their record', () => {
  assert.equal(notificationAccessPath('billing_order'), '/api/billing/orders');
  assert.equal(notificationAccessPath('billing_subscription'), '/api/billing/subscriptions');
  assert.equal(notificationAccessPath('clients'), '/api/workspace/clients');
  assert.equal(notificationAccessPath('client'), '/api/clients');
  assert.equal(notificationAccessPath('unknown'), null);
});

test('normalizes browser notification preferences and rejects malformed quiet-hour values', () => {
  assert.deepEqual(normalizeBrowserNotificationPreferences({ browser: true, newLead: false, quietHours: true, quietStart: '21:30', quietEnd: '06:45', payment: 'false' }), {
    taskDue: true, overdue: true, newLead: false, proposal: true, payment: true,
    browser: true, quietHours: true, quietStart: '21:30', quietEnd: '06:45',
  });
  assert.deepEqual(normalizeBrowserNotificationPreferences(null), {
    taskDue: true, overdue: true, newLead: true, proposal: true, payment: true,
    browser: false, quietHours: false, quietStart: '20:00', quietEnd: '08:00',
  });
  assert.equal(normalizeBrowserNotificationPreferences({ quietStart: '25:90' }).quietStart, '20:00');
});
