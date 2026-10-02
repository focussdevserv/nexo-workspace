import assert from 'node:assert/strict';
import test from 'node:test';
import { fileAssociationDraft, resolveFileAssociation } from './file-association.js';

const clients = [{ id: 'client-1', name: 'Café Aurora' }, { id: 'client-2', name: 'Ateliê Norte' }];
const projects = [{ id: 'project-1', name: 'Site institucional', clientId: 'client-1', client: 'Café Aurora' }];

test('resolves legacy file names to workspace client and project IDs', () => {
  assert.deepEqual(fileAssociationDraft({ client: 'Cafe Aurora', project: 'SITE INSTITUCIONAL' }, clients, projects), {
    clientId: 'client-1', projectId: 'project-1',
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
