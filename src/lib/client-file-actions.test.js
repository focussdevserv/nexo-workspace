import assert from 'node:assert/strict';
import test from 'node:test';
import { clientFileDeleteConfirmation, clientFileMetadataPatch, safeClientFileHref } from './client-file-actions.js';

test('opens only safe web URLs and uses the canonical Drive link when needed', () => {
  assert.equal(safeClientFileHref({ url: 'https://drive.google.com/file/d/file-1/view' }), 'https://drive.google.com/file/d/file-1/view');
  assert.equal(safeClientFileHref({ driveFileId: 'id with space' }), 'https://drive.google.com/open?id=id%20with%20space');
  for (const url of ['javascript:alert(1)', '//evil.test/file', 'https://user:pass@drive.google.com/x']) assert.equal(safeClientFileHref({ url }), '');
  assert.equal(safeClientFileHref({ localOnly: true, url: 'https://drive.google.com/x', driveFileId: 'demo' }), '');
});

test('file metadata can only be attached to a project belonging to the current client', () => {
  const file = { id: 'file-1' };
  const client = { id: 'client-1', name: 'Acme' };
  const projects = [{ id: 'project-1', clientId: 'client-1', name: 'Site' }, { id: 'project-2', clientId: 'client-2', name: 'Other' }];
  assert.deepEqual(clientFileMetadataPatch(file, { name: ' Contrato.pdf ', projectId: 'project-1', projects, client }), {
    name: 'Contrato.pdf', clientId: 'client-1', client: 'Acme', projectId: 'project-1', project: 'Site',
  });
  assert.throws(() => clientFileMetadataPatch(file, { name: 'Contrato.pdf', projectId: 'project-2', projects, client }), /client_file_project_invalid/);
  assert.throws(() => clientFileMetadataPatch(file, { name: ' ', projects, client }), /client_file_metadata_invalid/);
});

test('file editor accepts legacy projects linked by client name, as shown in the client profile', () => {
  const client = { id: 'client-1', name: 'Acme' };
  const file = { id: 'file-1' };
  const project = { id: 'legacy-project', name: 'Site legado', client: 'Acme' };
  assert.equal(clientFileMetadataPatch(file, {
    name: 'brief.pdf', projectId: project.id, projects: [project], client,
  }).projectId, project.id);
});

test('delete confirmation makes it explicit that the Drive original remains intact', () => {
  assert.match(clientFileDeleteConfirmation({ name: 'Escopo.pdf' }), /Google Drive será preservado/);
});
