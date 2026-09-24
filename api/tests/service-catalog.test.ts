import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeRequestedServiceCatalog, requestedServiceCatalog } from '../../src/data/service-catalog.js';
import { buildServiceProject } from '../../src/data/service-project-template.js';

test('imports each requested service once and skips names already stored', () => {
  const additions = mergeRequestedServiceCatalog([], requestedServiceCatalog);
  const names = additions.map((item) => item.name.toLocaleLowerCase('pt-BR'));
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.includes('site one page'));
  assert.ok(mergeRequestedServiceCatalog([{ name: 'site one page' }], requestedServiceCatalog).every((item) => item.name !== 'Site One Page'));
  assert.ok(additions.every((item) => !item.price && item.status === 'Rascunho'));
});

test('builds project and checklist tasks linked to the selected client and service', () => {
  const { project, tasks } = buildServiceProject({ name: 'Site institucional', category: 'Desenvolvimento', duration: '20 dias', responsible: 'Equipe web', templateTasks: ['Briefing', 'Publicar'] }, { id: 'client-1', name: 'Cliente A' }, 1000);
  assert.equal(project.clientId, 'client-1');
  assert.equal(project.service, 'Site institucional');
  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((task) => task.projectId === project.id && task.clientId === clientIdForTest));
  assert.equal(tasks[0].priority, 'Alta');
  assert.equal(tasks[1].priority, 'Normal');
});

const clientIdForTest = 'client-1';

test('requires an existing client before creating a project from a service', () => {
  assert.throws(() => buildServiceProject({ name: 'Landing page' }, null, 1000), /cliente cadastrado/i);
});
