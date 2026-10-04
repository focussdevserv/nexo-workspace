import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientProfileNavigationContext } from './client-profile-navigation.js';

const screenSource = readFileSync(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');

test('client profile navigation preserves selected client and action-specific record context', () => {
  const context = clientProfileNavigationContext(
    { id: 'client-42', name: 'Acme', email: 'acme@example.com', phone: '+5511999999999' },
    { approvalId: 'approval-9', intentId: 'open-approval', clientId: 'stale-client' },
  );

  assert.deepEqual(context, {
    approvalId: 'approval-9',
    intentId: 'open-approval',
    clientId: 'client-42',
    clientName: 'Acme',
    clientEmail: 'acme@example.com',
    clientPhone: '+5511999999999',
  });
});

test('client profile route dispatch enriches module actions with the selected client', () => {
  assert.match(screenSource, /context:\s*clientProfileNavigationContext\(client, context\)/);
});
