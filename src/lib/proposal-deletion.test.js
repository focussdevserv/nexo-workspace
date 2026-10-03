import test from 'node:test';
import assert from 'node:assert/strict';
import { proposalDeletionBlockReason } from './proposal-deletion.js';

test('blocks removal of accepted proposals persisted with English statuses', () => {
  for (const status of ['accepted', 'APPROVED']) {
    assert.ok(proposalDeletionBlockReason({ id: 'p-legacy', status }));
  }
});

test('blocks removal of an approved proposal to preserve its conversion history', () => {
  assert.match(proposalDeletionBlockReason({ id: 'p1', status: 'Aprovada' }), /preservar o histórico/);
});

test('blocks removal when generated contract or project remains linked', () => {
  assert.match(proposalDeletionBlockReason({ id: 'p1', status: 'Enviada' }, { contracts: [{ sourceProposalId: 'p1' }] }), /contrato, projeto e tarefas/);
  assert.match(proposalDeletionBlockReason({ id: 'p1', status: 'Em negociação' }, { projects: [{ sourceProposalId: 'p1' }] }), /preservar o histórico/);
});

test('allows removal of proposals with no conversion or linked delivery records', () => {
  assert.equal(proposalDeletionBlockReason({ id: 'p1', status: 'Rascunho' }), '');
  assert.equal(proposalDeletionBlockReason({ id: 'p1', status: 'Recusada' }, { contracts: [{ sourceProposalId: 'p2' }], projects: [{ sourceProposalId: 'p2' }] }), '');
});
