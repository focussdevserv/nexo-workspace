import assert from 'node:assert/strict';
import test from 'node:test';
import { approvalFileMatchesClientScope } from '../src/security/approval-file-scope.ts';

test('approval file must belong to the selected client', () => {
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', clientId: 'client-a' }, clientId: 'client-a', clientName: 'Acme',
  }), true);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', clientId: 'client-b' }, clientId: 'client-a', clientName: 'Acme',
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', client: 'Outra Empresa' }, clientId: 'client-a', clientName: 'Acme',
  }), false);
});

test('project-linked approvals accept only files from that client project', () => {
  const project = { clientId: 'client-a', client: 'Acme' };
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', projectId: 'project-a' }, clientId: 'client-a', clientName: 'Acme', projectId: 'project-a', projectName: 'Website', project,
  }), true);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', projectId: 'project-b', clientId: 'client-a' }, clientId: 'client-a', clientName: 'Acme', projectId: 'project-a', projectName: 'Website', project,
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', project: 'Website' }, clientId: 'client-a', clientName: 'Acme', projectId: 'project-a', projectName: 'Website', project,
  }), true);
});

test('approval file scope rejects wrong Drive ID and project belonging to another client', () => {
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-2', clientId: 'client-a' }, clientId: 'client-a', clientName: 'Acme',
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', projectId: 'project-a' }, clientId: 'client-a', clientName: 'Acme', projectId: 'project-a', projectName: 'Website', project: { clientId: 'client-b', client: 'Other' },
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1' }, clientId: 'client-a', clientName: 'Acme',
  }), false);
});

test('approval file scope rejects contradictory client and project references', () => {
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1',
    file: { driveFileId: 'drive-1', clientId: 'client-a', workspaceClientId: 'client-b' },
    clientId: 'client-a', clientName: 'Acme',
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1',
    file: { driveFileId: 'drive-1', clientId: 'client-a', projectId: 'project-a', sourceProjectId: 'project-b' },
    clientId: 'client-a', clientName: 'Acme', projectId: 'project-a', projectName: 'Website',
    project: { clientId: 'client-a', name: 'Website' },
  }), false);
});

test('a client file cannot be used to approve a project owned by another client', () => {
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', clientId: 'client-a' },
    clientId: 'client-a', clientName: 'Acme', projectId: 'project-b', projectName: 'Other project',
    project: { clientId: 'client-b', client: 'Other client' },
  }), false);
  assert.equal(approvalFileMatchesClientScope({
    fileId: 'drive-1', file: { driveFileId: 'drive-1', clientId: 'client-a' },
    clientId: 'client-a', clientName: 'Acme', projectId: 'project-unlinked', projectName: 'Unlinked project',
    project: { name: 'Unlinked project' },
  }), false);
});
