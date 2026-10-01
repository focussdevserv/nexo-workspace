import test from 'node:test';
import assert from 'node:assert/strict';
import { isClientApprovalPending, portalApprovalRecord } from '../src/integrations/client-approvals.js';

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
});
