import test from 'node:test';
import assert from 'node:assert/strict';
import { findProjectForTask, taskBelongsToProject } from './project-task-link.js';

const projectA = { id: 'project-a', name: 'Portal', clientId: 'client-a', client: 'Acme' };
const projectB = { id: 'project-b', name: 'Portal', clientId: 'client-b', client: 'Beta' };

test('project ID is authoritative even when another project has the same name', () => {
  assert.equal(taskBelongsToProject({ projectId: 'project-b', project: 'Portal' }, projectA, [projectA, projectB]), false);
  assert.equal(taskBelongsToProject({ projectId: 'project-a', project: 'Renamed' }, projectA, [projectA, projectB]), true);
});

test('legacy task links use unique project names and client data to disambiguate duplicates', () => {
  assert.equal(taskBelongsToProject({ project: 'Portal' }, projectA, [projectA]), true);
  assert.equal(taskBelongsToProject({ project: 'Portal', clientId: 'client-b' }, projectB, [projectA, projectB]), true);
  assert.equal(taskBelongsToProject({ project: 'Portal', client: 'Acme' }, projectA, [projectA, projectB]), true);
});

test('ambiguous legacy task links are not shown under multiple same-name projects', () => {
  const task = { project: 'Portal' };
  assert.equal(taskBelongsToProject(task, projectA, [projectA, projectB]), false);
  assert.equal(taskBelongsToProject(task, projectB, [projectA, projectB]), false);
});

test('task project ID remains authoritative for hour attribution with duplicate project names', () => {
  assert.equal(findProjectForTask({ projectId: 'project-b', project: 'Portal', clientId: 'client-b' }, [projectA, projectB]), projectB);
});

test('a stale explicit project ID does not silently link hours to a same-name project', () => {
  assert.equal(findProjectForTask({ projectId: 'deleted-project', project: 'Portal', clientId: 'client-a' }, [projectA, projectB]), null);
});

test('legacy task project names are disambiguated by client or rejected', () => {
  assert.equal(findProjectForTask({ project: 'Portal', clientId: 'client-b' }, [projectA, projectB]), projectB);
  assert.equal(findProjectForTask({ project: 'Portal' }, [projectA, projectB]), null);
});
