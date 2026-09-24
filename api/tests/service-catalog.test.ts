import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeRequestedServiceCatalog, requestedServiceCatalog } from '../../src/data/service-catalog.js';
import { buildServiceProject } from '../../src/data/service-project-template.js';

test('imports each service group once while preserving same-name catalog variants', () => {
  const additions = mergeRequestedServiceCatalog([], requestedServiceCatalog);
  const keys = additions.map((item) => `${item.catalogGroup}|${item.name.toLocaleLowerCase('pt-BR')}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(additions.filter((item) => item.name === 'Site One Page').length > 1);
  assert.ok(!mergeRequestedServiceCatalog([{ name: 'Site One Page', catalogGroup: 'Serviços avulsos' }], requestedServiceCatalog).some((item) => item.name === 'Site One Page' && item.catalogGroup === 'Serviços avulsos'));
  assert.ok(mergeRequestedServiceCatalog([{ name: 'Site One Page' }], requestedServiceCatalog).every((item) => item.name !== 'Site One Page'));
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
