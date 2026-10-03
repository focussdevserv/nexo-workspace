import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateWorkRecord, canSelectWorkspaceFileUpload, projectStatusFilters, shouldShowProjectKanbanEmpty } from './work-screen-actions.js';

test('collection create actions wait for load and stay disabled after load errors', () => {
  const screens = ['agenda', 'tarefas', 'projetos', 'arquivos', 'aprovacoes'];
  const collections = Object.fromEntries(['events', 'tasks', 'projects', 'files', 'approvals'].map((key) => [key, { loaded: false, error: '' }]));
  for (const screen of screens) assert.equal(canCreateWorkRecord(screen, collections), false, `${screen} must wait for its collection`);

  for (const key of Object.keys(collections)) collections[key] = { loaded: true, error: new Error('offline') };
  for (const screen of screens) assert.equal(canCreateWorkRecord(screen, collections), false, `${screen} must stop after a load error`);
});

test('collection create actions unlock only after a successful load', () => {
  const collections = {
    approvals: { loaded: true, error: '' },
    tasks: { loaded: true, error: '' },
  };
  assert.equal(canCreateWorkRecord('aprovacoes', collections), true);
  assert.equal(canCreateWorkRecord('tarefas', collections), true);
  assert.equal(canCreateWorkRecord('horas', collections), true);
});

test('project status filters include every Kanban stage', () => {
  for (const stage of ['A fazer', 'Em andamento', 'Aguardando cliente', 'Concluído', 'Arquivado']) {
    assert.ok(projectStatusFilters.includes(stage), `missing filter for ${stage}`);
  }
});

test('Kanban empty state follows visible projects and waits for a successful load', () => {
  assert.equal(shouldShowProjectKanbanEmpty({ visibleCount: 0, loaded: true, error: '' }), true);
  assert.equal(shouldShowProjectKanbanEmpty({ visibleCount: 2, loaded: true, error: '' }), false);
  assert.equal(shouldShowProjectKanbanEmpty({ visibleCount: 0, loaded: false, error: '' }), false);
  assert.equal(shouldShowProjectKanbanEmpty({ visibleCount: 0, loaded: true, error: 'offline' }), false);
});

test('file picker eligibility is consistent with permission, load, upload and scope state', () => {
  const eligible = { canWrite: true, uploading: false, loaded: true, error: '', scopeRequired: true, hasScopeLink: true };
  assert.equal(canSelectWorkspaceFileUpload(eligible), true);
  for (const override of [
    { canWrite: false }, { uploading: true }, { loaded: false }, { error: 'offline' }, { hasScopeLink: false },
  ]) assert.equal(canSelectWorkspaceFileUpload({ ...eligible, ...override }), false);
});
