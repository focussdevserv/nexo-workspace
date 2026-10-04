import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyClientProfileRetryResults,
  clientProfileActiveProjectsLabel,
  clientProfileFailedResources,
  clientProfileRelatedPaths,
  clientProfileResourceLabels,
  clientProfileSectionIsEmpty,
} from './client-profile-related-state.js';

test('projects section reports failed projects and tasks sources only', () => {
  const errors = { projects: 'HTTP 500', tasks: 'timeout', inbox: 'HTTP 403' };
  assert.deepEqual(clientProfileFailedResources('projects', errors), ['projects', 'tasks']);
  assert.equal(clientProfileResourceLabels(['projects', 'tasks']), 'projetos, tarefas');
});

test('history section reports every failed timeline source', () => {
  const errors = { events: 'x', billing: 'y', settings: 'ignored', inbox: 'ignored' };
  assert.deepEqual(clientProfileFailedResources('history', errors), ['events', 'billing']);
  assert.deepEqual(clientProfileFailedResources('unknown', errors), []);
});

test('empty state is not shown while loading or when a source failed', () => {
  assert.equal(clientProfileSectionIsEmpty({ section: 'projects', errors: {}, loading: false, count: 0 }), true);
  assert.equal(clientProfileSectionIsEmpty({ section: 'projects', errors: {}, loading: true, count: 0 }), false);
  assert.equal(clientProfileSectionIsEmpty({ section: 'projects', errors: { tasks: 'HTTP 500' }, count: 0 }), false);
  assert.equal(clientProfileSectionIsEmpty({ section: 'history', errors: { inbox: 'HTTP 500' }, count: 0 }), true);
  assert.equal(clientProfileSectionIsEmpty({ section: 'projects', errors: {}, count: 2 }), false);
});

test('active projects metric never reports zero for a failed load', () => {
  assert.equal(clientProfileActiveProjectsLabel({ count: 0, errors: { projects: 'HTTP 500' } }), 'Indisponível');
  assert.equal(clientProfileActiveProjectsLabel({ count: 0, loading: true }), '...');
  assert.equal(clientProfileActiveProjectsLabel({ count: 3 }), '3');
});

test('retry results replace recovered rows and keep remaining failures', () => {
  const related = { projects: [], tasks: [], files: [{ id: 'f1' }] };
  const errors = { projects: 'HTTP 500', tasks: 'timeout', files: 'other' };
  const next = applyClientProfileRetryResults(related, errors, [
    { resource: 'projects', rows: [{ id: 'p1' }], error: '' },
    { resource: 'tasks', rows: null, error: 'still down' },
  ]);
  assert.deepEqual(next.related.projects, [{ id: 'p1' }]);
  assert.deepEqual(next.related.tasks, []);
  assert.deepEqual(next.errors, { tasks: 'still down', files: 'other' });
  assert.deepEqual(errors, { projects: 'HTTP 500', tasks: 'timeout', files: 'other' });
});

test('retry paths cover every section resource', () => {
  for (const section of ['projects', 'history']) {
    const all = Object.fromEntries(Object.keys(clientProfileRelatedPaths).map((key) => [key, 'err']));
    for (const resource of clientProfileFailedResources(section, all)) {
      assert.match(clientProfileRelatedPaths[resource], /^\/api\//);
    }
  }
});

test('client profile wires failure state into projects, history and summary', () => {
  const source = readFileSync(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /retryClientProfileSection\("projects", projectFailedResources\)/);
  assert.match(source, /retryClientProfileSection\("history", historyFailedResources\)/);
  assert.match(source, /clientProfileSectionIsEmpty\(\{ section: "projects"/);
  assert.match(source, /clientProfileSectionIsEmpty\(\{ section: "history"/);
  assert.match(source, /clientProfileActiveProjectsLabel\(\{ count: countActiveWorkProjects\(projects\)/);
});
