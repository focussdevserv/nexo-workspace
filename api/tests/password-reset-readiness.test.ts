import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordResetDeliveryReadiness } from '../src/auth/password-reset-readiness.js';

test('does not claim recovery was sent when delivery credentials are missing', () => {
  const result = passwordResetDeliveryReadiness(undefined, undefined);
  assert.equal(result.statusCode, 503);
  assert.equal(result.error, 'password_reset_unavailable');
  assert.match(result.message, /Contate a pessoa administradora/);
});

test('treats empty or whitespace-only delivery credentials as unavailable', () => {
  assert.equal(passwordResetDeliveryReadiness('  ', 'sender@example.com').statusCode, 503);
  assert.equal(passwordResetDeliveryReadiness('resend-key', '\t').statusCode, 503);
});

test('allows the generic, account-enumeration-safe response when delivery is configured', () => {
  assert.deepEqual(passwordResetDeliveryReadiness('resend-key', 'sender@example.com'), { statusCode: 202 });
});
