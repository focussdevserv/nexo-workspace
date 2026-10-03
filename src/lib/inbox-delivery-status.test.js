import assert from 'node:assert/strict';
import test from 'node:test';
import { inboxDeliveryStatusLabel } from './inbox-delivery-status.js';

test('an ambiguous WhatsApp attempt tells the operator to verify the phone before sending again', () => {
  assert.match(inboxDeliveryStatusLabel('unknown'), /confira o WhatsApp antes de enviar outra mensagem/i);
});

test('known sending and failed states have distinct delivery labels', () => {
  assert.equal(inboxDeliveryStatusLabel('sending'), 'Enviando…');
  assert.equal(inboxDeliveryStatusLabel('failed'), 'Não enviado.');
  assert.equal(inboxDeliveryStatusLabel('sent'), '');
});
