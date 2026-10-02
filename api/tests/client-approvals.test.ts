import test from 'node:test';
import assert from 'node:assert/strict';
import { clientApprovalDecisionHasValidComment, clientPortalApprovalDecisionRecord, isClientApprovalPending, portalApprovalRecord } from '../src/integrations/client-approvals.js';

test('client approval decision requires a meaningful comment for requested changes', () => {
  assert.equal(clientApprovalDecisionHasValidComment('changes_requested', ''), false);
  assert.equal(clientApprovalDecisionHasValidComment('changes_requested', '  ok '), false);
  assert.equal(clientApprovalDecisionHasValidComment('changes_requested', ' Ajustar o título '), true);
  assert.equal(clientApprovalDecisionHasValidComment('approved', ''), true);
  assert.equal(clientApprovalDecisionHasValidComment('unknown', 'valid'), false);
});

test('public approval records only expose intended fields and shared Google Drive files', () => {
  const result = portalApprovalRecord('approval-1', {
    title: 'Home page', status: 'Aguardando', reviewer: 'internal@example.com', comments: [{ text: 'internal note' }],
    clientComment: 'Please adjust the heading.', attachment: { name: 'homepage.pdf', url: 'https://drive.google.com/file/d/file-123/view', mimeType: 'application/pdf', driveFileId: 'file-123', publicAccess: true },
  });
  assert.equal(result.title, 'Home page');
  assert.deepEqual(result.attachment, { name: 'homepage.pdf', url: 'https://drive.google.com/file/d/file-123/view', mimeType: 'application/pdf' });
  assert.equal(result.clientComment, 'Please adjust the heading.');
  assert.equal('reviewer' in result, false);
  assert.equal('comments' in result, false);
  assert.equal('driveFileId' in (result.attachment || {}), false);
});

test('public approval projection discards unsafe file links', () => {
  assert.equal(portalApprovalRecord('approval-1', { attachment: { name: 'x', url: 'https://evil.example/file' } }).attachment, null);
  assert.equal(portalApprovalRecord('approval-1', { attachment: { name: 'x', url: 'http://drive.google.com/file/d/abc/view' } }).attachment, null);
  assert.equal(portalApprovalRecord('approval-1', { attachment: { name: 'x', url: 'https://drive.google.com/file/d/abc/view', publicAccess: false } }).attachment, null);
});

test('approval status filter does not show completed states as pending', () => {
  assert.equal(isClientApprovalPending('Aprovada'), false);
  assert.equal(isClientApprovalPending('Aprovado'), false);
  assert.equal(isClientApprovalPending('Concluída'), false);
  assert.equal(isClientApprovalPending('Alterações solicitadas'), true);
  assert.equal(isClientApprovalPending('Aguardando'), true);
  assert.equal(isClientApprovalPending('  Aguardando  '), true);
  assert.equal(isClientApprovalPending('  Alterações solicitadas  '), true);
  assert.equal(isClientApprovalPending('Retirada'), false);
  assert.equal(isClientApprovalPending('Cancelada'), false);
});

test('portal decision preserves approval fields and stores the trimmed client comment', () => {
  const original = { clientId: 'client-a', status: 'Aguardando', title: 'Layout', comments: [{ text: 'internal' }] };
  const decided = clientPortalApprovalDecisionRecord(original, 'client-a', 'changes_requested', '  Ajustar o título  ', '2026-10-02T12:00:00.000Z');
  assert.deepEqual(decided, {
    ...original,
    status: 'Alterações solicitadas',
    clientComment: 'Ajustar o título',
    decidedAt: '2026-10-02T12:00:00.000Z',
  });
});

test('portal decision rejects a different or conflicting client and stale completed approval', () => {
  const pending = { clientId: 'client-a', status: 'Aguardando' };
  assert.equal(clientPortalApprovalDecisionRecord(pending, 'client-b', 'approved', '', 'now'), null);
  assert.equal(clientPortalApprovalDecisionRecord({ ...pending, workspaceClientId: 'client-b' }, 'client-a', 'approved', '', 'now'), null);
  assert.equal(clientPortalApprovalDecisionRecord({ ...pending, status: 'Aprovada' }, 'client-a', 'approved', '', 'now'), null);
  assert.equal(clientPortalApprovalDecisionRecord(pending, 'client-a', 'changes_requested', 'ok', 'now'), null);
});
