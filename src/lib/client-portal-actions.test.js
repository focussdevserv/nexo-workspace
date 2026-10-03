import test from 'node:test';
import assert from 'node:assert/strict';
import { appendSentPortalMessage, canSendPortalMessage, canSubmitPortalApprovalDecision, portalLinkActionLabel, shouldConfirmPortalLinkRotation, splitClientPortalApprovals } from './client-portal-actions.js';

test('an active portal link is clearly labeled as a replacement and requires confirmation', () => {
  assert.equal(portalLinkActionLabel(true), 'Substituir link atual');
  assert.equal(shouldConfirmPortalLinkRotation(true), true);
});

test('creating the first portal link does not ask to replace an existing link', () => {
  assert.equal(portalLinkActionLabel(false), 'Gerar link seguro');
  assert.equal(shouldConfirmPortalLinkRotation(false), false);
});

test('client portal keeps pending decisions actionable and completed decisions in history', () => {
  const approvals = [
    { id: 'pending', status: 'Aguardando' },
    { id: 'changes', status: 'Alterações solicitadas' },
    { id: 'approved', status: 'Aprovada', decidedAt: '2026-10-01T12:00:00Z' },
  ];
  const result = splitClientPortalApprovals(approvals);
  assert.deepEqual(result.pending.map((item) => item.id), ['pending', 'changes']);
  assert.deepEqual(result.history.map((item) => item.id), ['approved']);
  assert.deepEqual(splitClientPortalApprovals(null), { pending: [], history: [] });
});

test('requesting an approval change requires a meaningful comment and respects in-flight state', () => {
  assert.equal(canSubmitPortalApprovalDecision('changes_requested', ''), false);
  assert.equal(canSubmitPortalApprovalDecision('changes_requested', '  ok '), false);
  assert.equal(canSubmitPortalApprovalDecision('changes_requested', ' Ajustar o título '), true);
  assert.equal(canSubmitPortalApprovalDecision('approved', ''), true);
  assert.equal(canSubmitPortalApprovalDecision('approved', '', true), false);
  assert.equal(canSubmitPortalApprovalDecision('unknown', 'valid comment'), false);
});

test('portal messages reject whitespace-only text and disable duplicate sends', () => {
  assert.equal(canSendPortalMessage('  \n  '), false);
  assert.equal(canSendPortalMessage(' Olá, preciso de ajuda. '), true);
  assert.equal(canSendPortalMessage('mensagem válida', true), false);
});

test('a successfully saved portal message is visible in the current session without duplicating it', () => {
  const sent = appendSentPortalMessage([], '  Olá, preciso de ajuda.  ', 'inbox-record-1');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, 'inbox-record-1');
  assert.equal(sent[0].text, 'Olá, preciso de ajuda.');
  assert.ok(Number.isFinite(Date.parse(sent[0].sentAt)));
  assert.equal(appendSentPortalMessage(sent, 'Olá, preciso de ajuda.', 'inbox-record-1'), sent);
  assert.deepEqual(appendSentPortalMessage(sent, '  '), sent);
});
