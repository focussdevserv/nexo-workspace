import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLinkedDriveFileRecord, fileAssociationDraft, resolveFileAssociation } from './file-association.js';

const clients = [{ id: 'client-1', name: 'Café Aurora' }, { id: 'client-2', name: 'Ateliê Norte' }];
const projects = [{ id: 'project-1', name: 'Site institucional', clientId: 'client-1', client: 'Café Aurora' }];

test('resolves legacy file names to workspace client and project IDs', () => {
  assert.deepEqual(fileAssociationDraft({ client: 'Cafe Aurora', project: 'SITE INSTITUCIONAL' }, clients, projects), {
    clientId: 'client-1', projectId: 'project-1',
  });
});

test('preserves client associations stored in legacy workspaceClientId or clientRecordId fields', () => {
  const expected = { clientId: 'client-1', projectId: '' };
  assert.deepEqual(fileAssociationDraft({ workspaceClientId: 'client-1' }, clients, []), expected);
  assert.deepEqual(fileAssociationDraft({ clientRecordId: 'client-1' }, clients, []), expected);
});

test('does not guess a client name when stored client IDs conflict', () => {
  assert.deepEqual(fileAssociationDraft({ clientId: 'client-1', clientRecordId: 'client-2', client: clients[0].name }, clients, []), {
    clientId: '', projectId: '', associationError: 'file_client_ids_conflict',
  });
});

test('does not relink a deleted project by a duplicate display name', () => {
  const duplicateNameProjects = [
    { id: 'project-1', name: 'Site institucional', clientId: 'client-1' },
    { id: 'project-2', name: 'Site institucional', clientId: 'client-2' },
  ];
  assert.deepEqual(fileAssociationDraft({ projectId: 'deleted-project', project: 'Site institucional' }, clients, duplicateNameProjects), {
    clientId: '', projectId: '', associationError: 'file_project_not_found',
  });
});

test('flags a saved client and project that point to different clients for review', () => {
  const linked = fileAssociationDraft({ clientId: 'client-2', projectId: 'project-1' }, clients, projects);
  assert.deepEqual(linked, {
    clientId: 'client-2', projectId: 'project-1', associationError: 'file_project_client_mismatch',
  });
});

test('choosing a project saves canonical IDs and derives its client', () => {
  assert.deepEqual(resolveFileAssociation({ projectId: 'project-1' }, clients, projects), {
    clientId: 'client-1', client: 'Café Aurora', projectId: 'project-1', project: 'Site institucional',
  });
});

test('rejects a project belonging to a different selected client', () => {
  assert.deepEqual(resolveFileAssociation({ clientId: 'client-2', projectId: 'project-1' }, clients, projects), {
    error: 'file_project_client_mismatch',
  });
});

test('linked Drive records keep the selected project and client names for cards and search', () => {
  const linked = buildLinkedDriveFileRecord({
    file: { id: 'drive-1', name: 'Brief.pdf', mimeType: 'application/pdf', url: 'https://drive.google.com/open?id=drive-1' },
    id: 'workspace-file-1',
    scopeLink: { projectId: 'project-1', clientId: 'client-1' },
    clients,
    projects,
    date: '03/10/2026',
    size: '2 MB',
    type: 'pdf',
  });

  assert.equal(linked.client, clients[0].name);
  const linkedRecord = { ...linked };
  delete linkedRecord.client;
  assert.deepEqual(linkedRecord, {
    id: 'workspace-file-1', name: 'Brief.pdf', project: 'Site institucional',
    date: '03/10/2026', size: '2 MB', type: 'pdf', folder: false,
    url: 'https://drive.google.com/open?id=drive-1', driveFileId: 'drive-1', mimeType: 'application/pdf',
    clientId: 'client-1', projectId: 'project-1',
  });
});

test('rejects a linked Drive record when its selected project has been removed', () => {
  assert.deepEqual(buildLinkedDriveFileRecord({
    file: { id: 'drive-1', name: 'Brief.pdf' }, id: 'workspace-file-1',
    scopeLink: { projectId: 'deleted-project' }, clients, projects,
  }), { error: 'file_project_not_found' });
});
