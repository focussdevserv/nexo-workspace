import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToClient } from '../../src/data/client-link.js';

test('links workspace rows by client ID before considering display names', () => {
  const client = { id: 'client-1', name: 'FocussDev' };
  assert.equal(belongsToClient({ clientId: 'client-1', client: 'Outra empresa' }, client), true);
  assert.equal(belongsToClient({ clientId: 'client-2', client: 'FocussDev' }, client), false);
});

test('uses the workspace client link before a legacy billing client ID', () => {
  const client = { id: 'workspace-client', name: 'Acme' };
  assert.equal(belongsToClient({ workspaceClientId: 'workspace-client', clientId: 'billing-client', clientName: 'Other' }, client), true);
  assert.equal(belongsToClient({ workspaceClientId: 'different-workspace-client', clientId: null, clientName: 'Acme' }, client), false);
});

test('matches legacy rows by normalized exact name, not a partial name', () => {
  const client = { id: 'client-1', name: 'Clínica São João' };
  assert.equal(belongsToClient({ client: 'clinica   sao joao' }, client), true);
  assert.equal(belongsToClient({ client: 'Clínica São João Odontologia' }, client), false);
  assert.equal(belongsToClient({ client: 'Clínica São Joao' }, client), true);
});

test('does not link empty or missing names to a client', () => {
  const client = { id: 'client-1', name: 'Cliente' };
  assert.equal(belongsToClient({}, client), false);
  assert.equal(belongsToClient({ client: '' }, client), false);
});
