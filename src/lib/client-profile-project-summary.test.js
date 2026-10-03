import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countActiveWorkProjects, isWorkProjectActive } from './work-project-activity.js';

test('client profile active-project metric excludes archived and completed project states', () => {
  const projects = [
    { status: 'Em andamento' },
    { status: 'Aguardando cliente' },
    { status: 'Concluido' },
    { status: 'Arquivado' },
  ];

  assert.equal(countActiveWorkProjects(projects), 2);
});

test('commercial client portfolio uses the same active status rules as the client profile', () => {
  const projects = [
    { status: 'Em andamento', clientId: 'client-1' },
    { status: 'Done', clientId: 'client-1' },
    { status: 'Archived', clientId: 'client-1' },
  ];
  assert.equal(projects.filter(isWorkProjectActive).length, 1);
});

test('CRM client summary uses the shared active-project definition', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ countActiveWorkProjects, isWorkProjectActive \} from "\.\.\/lib\/work-project-activity\.js"/);
  assert.match(source, /<small>Projetos ativos<\/small><b>\{countActiveWorkProjects\(projects\)\}<\/b>/);
  assert.match(source, /relatedProjects\.filter\(project => isWorkProjectActive\(project\)/);
});
