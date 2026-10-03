import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardPendingProposalCount } from './dashboard-pending-proposals.js';

test('Meu Dia counts only proposals still pending in the CRM lifecycle', () => {
  const proposals = [
    { status: 'Enviada' },
    { status: 'Em negociação' },
    { status: 'Rascunho' },
    { status: 'Aprovada' },
    { status: 'APPROVED' },
    { status: 'Recusada' },
    { status: 'Expirada' },
    { status: 'REJECTED' },
  ];

  assert.equal(dashboardPendingProposalCount(proposals), 3);
});

test('Meu Dia ignores malformed proposal rows and handles unavailable input', () => {
  assert.equal(dashboardPendingProposalCount([null, 'invalid', [], { status: 'Enviada' }]), 1);
  assert.equal(dashboardPendingProposalCount(null), 0);
});
