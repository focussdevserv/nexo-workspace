import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeNotificationPreferences,
} from './email-notification-consent.js';

test('unsupported email, digest, and WhatsApp channels stay off while browser preferences remain intact', () => {
  assert.deepEqual(normalizeNotificationPreferences({ email: true, weekly: true, whatsapp: true, browser: true, payment: false }), {
    email: false,
    weekly: false,
    whatsapp: false,
    browser: true,
    payment: false,
    emailConsentVersion: 0,
    emailConsentAt: '',
    emailConsentAddress: '',
  });
  assert.deepEqual(normalizeNotificationPreferences({ email: false }), {
    email: false,
    weekly: false,
    whatsapp: false,
    emailConsentVersion: 0,
    emailConsentAt: '',
    emailConsentAddress: '',
  });
});
