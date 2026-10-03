import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentResultInstructionKind } from './payment-result-instructions.js';

test('recognizes Pix instructions when the provider returns only the copy-and-paste code', () => {
  assert.equal(paymentResultInstructionKind({ method: 'pix', paymentDetails: { pixCode: '000201...' } }), 'pix');
});

test('recognizes available QR, boleto, and card instructions', () => {
  assert.equal(paymentResultInstructionKind({ method: 'pix', paymentDetails: { pixQrCodeBase64: 'image-data' } }), 'pix');
  assert.equal(paymentResultInstructionKind({ method: 'boleto', paymentDetails: { ticketUrl: 'https://example.test/boleto' } }), 'boleto');
  assert.equal(paymentResultInstructionKind({ method: 'credit_card' }), 'card');
  assert.equal(paymentResultInstructionKind({ method: 'pix', paymentDetails: {} }), 'unavailable');
});
