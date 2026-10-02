import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppChatId } from './whatsapp-phone.js';

test('normalizes Brazilian local phone numbers to WAHA chat ids', () => {
  assert.equal(normalizeWhatsAppChatId('(11) 98765-4321'), '5511987654321@c.us');
  assert.equal(normalizeWhatsAppChatId('11 2345-6789'), '551123456789@c.us');
});

test('preserves country-prefixed numbers and rejects unusable phone values', () => {
  assert.equal(normalizeWhatsAppChatId('+1 202-555-0188'), '12025550188@c.us');
  for (const value of ['', 'abc', '1234567', '1234567890123456']) {
    assert.equal(normalizeWhatsAppChatId(value), '', `expected ${value || 'empty'} to be rejected`);
  }
});
