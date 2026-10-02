import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateWorkRecord } from './work-screen-actions.js';

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
