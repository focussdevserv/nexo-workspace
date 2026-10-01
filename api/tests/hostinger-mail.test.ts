import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHostingerCredentials } from '../src/integrations/hostinger-mail.js';

test('normalizes the Hostinger mailbox address and preserves the mailbox password', () => {
  assert.deepEqual(normalizeHostingerCredentials({ email: '  Name@Example.com ', password: 'mailbox-password' }), {
    email: 'name@example.com', password: 'mailbox-password',
  });
});

test('rejects malformed email addresses and unsafe passwords', () => {
  for (const input of [
    { email: 'name@localhost', password: 'secret' },
    { email: 'name@example.com', password: '' },
    { email: 'name@example.com', password: 'secret\r\nBcc:attacker@example.com' },
    { email: 'name@example.com', password: 'x'.repeat(257) },
  ]) assert.throws(() => normalizeHostingerCredentials(input));
});
