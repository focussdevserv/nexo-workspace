import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDashboardTasks } from './dashboard-task-filter.js';

const tasks = [
  { id: 'doing', state: 'Em andamento' },
  { id: 'pending', status: 'Pendente' },
  { id: 'todo', state: 'A fazer' },
  { id: 'done', state: 'Concluída' },
];

test('Meu Dia Todas includes open and completed tasks', () => {
  assert.deepEqual(filterDashboardTasks(tasks, 'Todas').map((task) => task.id), ['doing', 'pending', 'todo', 'done']);
});

test('Meu Dia task tabs filter each status using the visible accented completed label', () => {
  assert.deepEqual(filterDashboardTasks(tasks, 'Em andamento').map((task) => task.id), ['doing']);
  assert.deepEqual(filterDashboardTasks(tasks, 'Pendente').map((task) => task.id), ['pending', 'todo']);
  assert.deepEqual(filterDashboardTasks(tasks, 'Concluída').map((task) => task.id), ['done']);
});

test('Meu Dia prioritizes completion when legacy task status fields disagree', () => {
  const inconsistent = [
    { id: 'status-done', state: 'Pendente', status: 'Concluída' },
    { id: 'state-done', state: 'Concluída', status: 'A fazer' },
  ];
  assert.deepEqual(filterDashboardTasks(inconsistent, 'Concluída').map((task) => task.id), ['status-done', 'state-done']);
  assert.deepEqual(filterDashboardTasks(inconsistent, 'Pendente'), []);
  assert.deepEqual(filterDashboardTasks(inconsistent, 'Em andamento'), []);
});
