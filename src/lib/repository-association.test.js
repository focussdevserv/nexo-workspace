import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepositoryAssociationPayload, repositoryAssociationDraft, repositoryAssociationIssue } from './repository-association.js';

const projects = [{ id: 'p-1', name: 'Portal Aurora' }];
const clients = [{ id: 'c-1', name: 'Aurora Café' }];

test('editing a linked repository keeps its canonical project and client association', () => {
  assert.deepEqual(repositoryAssociationDraft({ projectId: 'p-1', project: 'Portal Aurora' }), {
    projectId: 'p-1', clientId: '', project: 'Portal Aurora', clientName: '',
  });
  assert.equal(repositoryAssociationIssue({ draft: { projectId: 'p-1' }, scopeMode: 'selected', projects }), '');
});

test('selected scopes require a canonical project or client reference', () => {
  assert.match(repositoryAssociationIssue({ draft: { project: 'Projeto antigo' }, scopeMode: 'selected', projects, clients }), /Vincule este repositório/);
  assert.equal(repositoryAssociationIssue({ draft: { clientId: 'c-1' }, scopeMode: 'selected', clients }), '');
  assert.equal(repositoryAssociationIssue({ draft: { projectId: 'p-1' }, scopeMode: 'selected', projects }), '');
});

test('a selected reference must exist in the scoped option set and be validated before save', () => {
  assert.match(repositoryAssociationIssue({ draft: { projectId: 'outside' }, scopeMode: 'selected', projects }), /Selecione um projeto disponível/);
  assert.match(repositoryAssociationIssue({ draft: { projectId: 'p-1' }, scopeMode: 'selected', projectsLoading: true, projects }), /Aguarde/);
  assert.match(repositoryAssociationIssue({ draft: { clientId: 'c-1' }, scopeMode: 'selected', clientsError: 'offline', clients }), /Atualize/);
});

test('repository association persists only one canonical scope reference', () => {
  assert.deepEqual(buildRepositoryAssociationPayload({ projectId: 'p-1', clientId: 'c-1', project: 'old' }, { projects, clients }), {
    projectId: 'p-1', clientId: '', clientName: '', project: 'Portal Aurora',
  });
  assert.deepEqual(buildRepositoryAssociationPayload({ clientId: 'c-1' }, { projects, clients }), {
    projectId: '', clientId: 'c-1', clientName: 'Aurora Café', project: '',
  });
  assert.deepEqual(buildRepositoryAssociationPayload({ project: 'Legacy description' }), {
    projectId: '', clientId: '', clientName: '', project: 'Legacy description',
  });
});

test('an unscoped repository may keep a legacy text description without an ID', () => {
  assert.equal(repositoryAssociationIssue({ draft: { project: 'Portal antigo' }, scopeMode: 'all' }), '');
});
