import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canMutateN8nWorkflows, n8nMutationUnavailableMessage } from './automation-remote-actions.js';

test('requires a fresh successful n8n snapshot before remote workflow changes', () => {
  const staleSnapshot = { workflows: [{ id: 'wf-1' }] };
  assert.equal(canMutateN8nWorkflows({ data: staleSnapshot, error: 'n8n timeout' }), false);
  assert.equal(canMutateN8nWorkflows({ data: staleSnapshot, loading: true }), false);
  assert.equal(canMutateN8nWorkflows({ data: null }), false);
  assert.equal(canMutateN8nWorkflows({ data: staleSnapshot }), true);
});

test('automation remote actions guard handlers and controls during a stale snapshot', async () => {
  const screen = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  assert.match(screen, /canMutateN8nWorkflows\(\{ data: n8nData, loading: n8nLoading, error: n8nError \}\)/);
  assert.match(screen, /disabled=\{Boolean\(busy\) \|\| !n8nActionsAvailable\}/);
  assert.match(screen, /if \(!n8nActionsAvailable\) \{ notify\(n8nMutationUnavailableMessage/);
});

test('explains that a failed refresh requires a fresh connection check', () => {
  assert.equal(n8nMutationUnavailableMessage({ error: 'timeout' }),
    'Atualize o status do n8n e confirme a conexão antes de alterar workflows.');
});
