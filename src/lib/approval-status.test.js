import test from 'node:test';
import assert from 'node:assert/strict';
import { isApprovalAwaitingDecision, isApprovalPending, normalizeApprovalStatus } from './approval-status.js';

test('approval decisions and pending states ignore case, accents, and surrounding whitespace', () => {
  assert.equal(isApprovalAwaitingDecision('  AGUARDANDO  '), true);
  assert.equal(isApprovalPending('Alterações solicitadas'), true);
  assert.equal(isApprovalPending('ALTERACOES SOLICITADAS'), true);
  assert.equal(isApprovalPending('Ajustes solicitados'), true);
  assert.equal(isApprovalPending('Aprovada'), false);
  assert.equal(normalizeApprovalStatus(null), '');
});
