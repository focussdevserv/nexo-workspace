import assert from 'node:assert/strict';
import test from 'node:test';
import { proposalAcceptanceDisposition } from '../src/integrations/proposal-acceptance.js';

test('allows a pending proposal to enter the acceptance transaction', () => {
  assert.equal(proposalAcceptanceDisposition('Enviada'), 'create_bundle');
  assert.equal(proposalAcceptanceDisposition('Em negociação'), 'create_bundle');
});

test('returns an approved proposal as idempotent instead of recreating records', () => {
  assert.equal(proposalAcceptanceDisposition('Aprovada'), 'return_existing');
  assert.equal(proposalAcceptanceDisposition('aprovada'), 'return_existing');
  assert.equal(proposalAcceptanceDisposition('APPROVED'), 'return_existing');
  assert.equal(proposalAcceptanceDisposition('accepted'), 'return_existing');
});

test('rejects refused and expired proposals', () => {
  assert.equal(proposalAcceptanceDisposition('Recusada'), 'reject_closed');
  assert.equal(proposalAcceptanceDisposition('rejected'), 'reject_closed');
  assert.equal(proposalAcceptanceDisposition('Expirada'), 'reject_closed');
  assert.equal(proposalAcceptanceDisposition('expired'), 'reject_closed');
});
