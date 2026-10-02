import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalAcceptanceState } from './proposal-acceptance-state.js';

test('normalizes approved proposal states before local acceptance retries', () => {
  for (const status of ['Aprovada', ' aprovada ', 'APROVADA', 'accepted']) {
    assert.equal(proposalAcceptanceState(status), 'accepted');
  }
});

test('normalizes closed proposal states and leaves other states pending', () => {
  for (const status of ['Recusada', ' recusada ', 'Expirada', 'REJECTED', 'expired']) {
    assert.equal(proposalAcceptanceState(status), 'closed');
  }
  for (const status of ['Rascunho', 'Enviada', 'Em negociação', null]) {
    assert.equal(proposalAcceptanceState(status), 'pending');
  }
});
