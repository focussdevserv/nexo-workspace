import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectTemplateTasks, projectTemplateChoices } from './project-templates.js';

test('project template seeds tasks linked to the saved project and its client', () => {
  const project = { id: 'project-1', name: 'Aurora Site', client: 'Aurora', clientId: 'client-1', team: ['Ana'] };
  const tasks = buildProjectTemplateTasks('website', project, (index => `task-${index + 1}`));
  assert.equal(tasks.length, 6);
  assert.equal(tasks[0].title, 'Briefing e objetivos');
  assert.equal(tasks[0].projectId, project.id);
  assert.equal(tasks[0].clientId, project.clientId);
  assert.equal(tasks[0].assignee, 'Ana');
  assert.deepEqual(tasks.map((task) => task.templateOrder), [1, 2, 3, 4, 5, 6]);
});

test('blank and unknown project templates do not create accidental tasks', () => {
  assert.deepEqual(buildProjectTemplateTasks('blank', { id: 'p' }), []);
  assert.deepEqual(buildProjectTemplateTasks('unknown', { id: 'p' }), []);
  assert.ok(projectTemplateChoices().some(({ value, taskCount }) => value === 'branding' && taskCount === 6));
});
