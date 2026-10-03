import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateWorkRecord, canSelectWorkspaceFileUpload, projectMatchesStatusFilter, projectStatusFilters, shouldShowProjectKanbanEmpty } from './work-screen-actions.js';

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

test('project status filters include legacy completed aliases and keep archived projects out of Todos', () => {
  for (const status of ['Concluído', 'Concluida', 'completed', 'complete', 'done']) {
    const project = { status };
    assert.equal(projectMatchesStatusFilter(project, 'Concluído'), true, `${status} should appear as completed`);
    assert.equal(projectMatchesStatusFilter(project, 'Todos'), true, `${status} should appear in Todos`);
  }
  for (const status of ['Arquivado', 'archived']) {
    const project = { status };
    assert.equal(projectMatchesStatusFilter(project, 'Arquivado'), true, `${status} should appear in Arquivado`);
    assert.equal(projectMatchesStatusFilter(project, 'Todos'), false, `${status} should not appear in Todos`);
  }
  assert.equal(projectMatchesStatusFilter({ status: 'active' }, 'Em andamento'), true);
  assert.equal(projectMatchesStatusFilter({ status: 'pending' }, 'A fazer'), true);
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
