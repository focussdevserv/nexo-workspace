import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveActivityNotificationTitle } from '../src/notifications.js';

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
});
