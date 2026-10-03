import assert from 'node:assert/strict';
import test from 'node:test';
import { countActiveWorkProjects, isWorkProjectActive } from './work-project-activity.js';

test('paused, cancelled, archived, and completed project states are not active', () => {
  for (const status of ['Pausado', 'Paused', 'Suspenso', 'Arquivado', 'Cancelado', 'Cancelled', 'Concluído', 'Completed']) {
    assert.equal(isWorkProjectActive({ status }), false, `${status} should be inactive`);
  }
});

test('ongoing and awaiting-client projects remain active', () => {
  assert.equal(isWorkProjectActive({ status: 'Em andamento' }), true);
  assert.equal(isWorkProjectActive({ status: 'Aguardando cliente' }), true);
});

test('counts active projects using status or legacy state without mutating records', () => {
  const projects = [
    { id: 1, status: 'Em andamento' },
    { id: 2, status: 'Aguardando cliente' },
    { id: 3, state: 'paused' },
    { id: 4, status: 'Cancelado' },
    { id: 5, status: 'Concluído' },
  ];
  const snapshot = structuredClone(projects);
  assert.equal(countActiveWorkProjects(projects), 2);
  assert.deepEqual(projects, snapshot);
});
