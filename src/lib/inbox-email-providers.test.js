import assert from 'node:assert/strict';
import test from 'node:test';
import { availableInboxEmailProviders } from './inbox-email-providers.js';

test('inbox offers only enabled email providers with a linked account', () => {
  const rows = [
    { name: 'Google Workspace', enabled: true, accountEmail: 'team@example.com' },
    { name: 'Hostinger E-mail', enabled: true, accountEmail: 'support@example.com' },
    { name: 'Google Workspace', enabled: false, accountEmail: 'paused@example.com' },
    { name: 'Hostinger E-mail', enabled: true, accountEmail: '' },
    { name: 'Resend', enabled: true, accountEmail: 'sender@example.com' },
  ];

  assert.deepEqual(availableInboxEmailProviders(rows), rows.slice(0, 2));
});

test('missing or malformed provider status is not mistaken for a connection', () => {
  assert.deepEqual(availableInboxEmailProviders(undefined), []);
  assert.deepEqual(availableInboxEmailProviders({ data: [] }), []);
});
