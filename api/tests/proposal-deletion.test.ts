import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { proposalDeletionBlockReason } from '../src/crm/proposal-deletion.js';

const serverSource = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');

test('blocks deletion of accepted proposals across localized and legacy statuses', () => {
  for (const status of ['Aprovada', 'APPROVED', 'accepted']) {
    assert.ok(proposalDeletionBlockReason(status, false));
  }
});

test('blocks deletion whenever an accepted delivery record still links to the proposal', () => {
  assert.ok(proposalDeletionBlockReason('Enviada', true));
});

test('allows deletion of an unconverted proposal without linked deliveries', () => {
  assert.equal(proposalDeletionBlockReason('Recusada', false), '');
  assert.equal(proposalDeletionBlockReason('Rascunho', false), '');
});

test('proposal DELETE route checks accepted status and linked deliveries under a row lock', () => {
  const start = serverSource.indexOf("app.delete('/api/workspace/:resource/:id'");
  const end = serverSource.indexOf("app.delete('/api/workspace/clients/:id/portal-link'");
  const route = serverSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /params\.data\.resource === 'proposals'/);
  assert.match(route, /\.for\('update'\)/);
  assert.match(route, /proposalDeletionBlockReason\(proposal\.data\.status, Boolean\(linkedContract \|\| linkedProject\)\)/);
  assert.match(route, /proposal_delete_protected/);
});
