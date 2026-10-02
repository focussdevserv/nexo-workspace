import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDashboardActiveProjects } from './dashboard-active-projects.js';

test('Meu Dia counts only ongoing projects and recognizes valid legacy active states', () => {
  const projects = [
    { id: 'ongoing', status: 'Em andamento' },
    { id: 'legacy-case', status: 'em ANDAMENTO' },
    { id: 'legacy-active', status: 'active' },
    { id: 'legacy-in-progress', state: 'in_progress' },
    { id: 'waiting', status: 'Aguardando cliente' },
    { id: 'todo', status: 'A fazer' },
    { id: 'done', status: 'Concluído' },
    { id: 'archived', status: 'Arquivado' },
    { id: 'unknown', status: 'Em análise' },
  ];

  assert.deepEqual(filterDashboardActiveProjects(projects).map((project) => project.id), [
    'ongoing', 'legacy-case', 'legacy-active', 'legacy-in-progress',
  ]);
});

test('Meu Dia returns no active projects for missing or unknown states', () => {
  assert.deepEqual(filterDashboardActiveProjects([{ name: 'Sem etapa' }, { status: 'Pausado' }]), []);
});
