import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProjectTasks } from './project-task-progress.js';

test('project progress counts legacy and canonical completed task statuses consistently', () => {
  assert.deepEqual(summarizeProjectTasks([
    { status: 'Concluída' },
    { state: 'done', status: 'A fazer' },
    { status: 'Em andamento' },
  ]), { total: 3, completed: 2, percent: 67 });
});

test('project progress reports zero without tasks', () => {
  assert.deepEqual(summarizeProjectTasks([]), { total: 0, completed: 0, percent: 0 });
});
