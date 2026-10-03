import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireClientPortalActionAfterConfirmation, appendSentPortalMessage, canOfferClientPortalPaymentAction, canSendPortalMessage, canSubmitPortalApprovalDecision, copyPortalLink, createClientPortalActionLock, portalLinkActionLabel, safeClientPortalHref, shouldConfirmPortalLinkRotation, splitClientPortalApprovals } from './client-portal-actions.js';

test('client portal payment actions are available only for payable invoices', () => {
  for (const status of ['pending', 'Aguardando pagamento', 'overdue', 'Vencida']) assert.equal(canOfferClientPortalPaymentAction(status), true, status);
  for (const status of ['paid', 'canceled', 'cancelled', 'rejected', 'expired', 'refunded', 'failed', 'processing', '']) assert.equal(canOfferClientPortalPaymentAction(status), false, status);
});

test('client portal prevents duplicate UI actions until the active request settles', () => {
  const lock = createClientPortalActionLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test('canceling link rotation leaves the portal action lock available for the next attempt', () => {
  const lock = createClientPortalActionLock();
  assert.equal(acquireClientPortalActionAfterConfirmation(lock, true, () => false), false);
  assert.equal(acquireClientPortalActionAfterConfirmation(lock, true, () => true), true);
  lock.release();
});

test('client portal links allow web and root-relative URLs while rejecting executable or ambiguous destinations', () => {
  assert.equal(safeClientPortalHref('https://files.example.test/invoice'), 'https://files.example.test/invoice');
  assert.equal(safeClientPortalHref('/files/invoice.pdf'), '/files/invoice.pdf');
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', '//attacker.example/path', '/\\\\attacker.example', 'https://user:pass@example.test/path']) {
    assert.equal(safeClientPortalHref(value), '', value);
  }
});

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

test('portal link copy prefers the secure clipboard API', async () => {
  let copied = '';
  const mode = await copyPortalLink('https://example.test/portal/token', {
    clipboard: { writeText: async (value) => { copied = value; } },
    documentRef: null,
  });
  assert.equal(mode, 'clipboard');
  assert.equal(copied, 'https://example.test/portal/token');
});

test('portal link copy falls back to a temporary selected field when clipboard access is blocked', async () => {
  const appended = [];
  const removed = [];
  let copied = '';
  let restoredFocus = false;
  const field = {
    value: '', style: {},
    setAttribute() {}, focus() {}, select() {},
    remove() { removed.push(this); },
  };
  const documentRef = {
    body: { appendChild: (element) => appended.push(element) },
    activeElement: { focus: () => { restoredFocus = true; } },
    createElement: () => field,
    execCommand(command) { copied = command === 'copy' ? field.value : ''; return command === 'copy'; },
  };
  const mode = await copyPortalLink('https://example.test/portal/token', {
    clipboard: { writeText: async () => { throw new Error('permission denied'); } },
    documentRef,
  });
  assert.equal(mode, 'legacy');
  assert.equal(copied, 'https://example.test/portal/token');
  assert.equal(appended.length, 1);
  assert.deepEqual(removed, [field]);
  assert.equal(restoredFocus, true);
});

test('portal link copy reports unsupported and rejected fallback cases', async () => {
  await assert.rejects(copyPortalLink('   ', { clipboard: null, documentRef: null }), /vazio/);
  await assert.rejects(copyPortalLink('https://example.test/link', { clipboard: null, documentRef: null }), /não permite copiar/);
  const documentRef = {
    body: { appendChild() {} }, activeElement: null,
    createElement: () => ({ style: {}, setAttribute() {}, focus() {}, select() {}, remove() {} }),
    execCommand: () => false,
  };
  await assert.rejects(copyPortalLink('https://example.test/link', { clipboard: null, documentRef }), /recusada/);
});
