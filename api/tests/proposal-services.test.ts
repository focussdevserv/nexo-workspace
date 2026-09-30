import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveProposalServices, summarizeProposalServices } from '../../src/data/proposal-services.js';

test('selects multiple requested services in chosen order and removes duplicate IDs', () => {
  const catalog = [{ id: 'site', name: 'Site' }, { id: 'care', name: 'Manutenção' }];
  assert.deepEqual(resolveProposalServices(catalog, ['care', 'site', 'care']), [catalog[1], catalog[0]]);
  assert.deepEqual(resolveProposalServices(catalog, ['missing']), []);
});

test('builds proposal scope and project defaults from selected services without inventing prices', () => {
  const services = [
    { id: 'site', name: 'Site institucional', proposalTemplate: 'Escopo do site', contractTemplate: 'Contrato do site', templateTasks: ['Briefing', 'Design'], responsible: 'Ana', price: '' },
    { id: 'care', name: 'Manutenção', proposalTemplate: 'Escopo mensal', contractTemplate: 'Contrato mensal', templateTasks: ['Briefing', 'Monitoramento'], responsible: 'Beto', price: '' },
  ];
  const summary = summarizeProposalServices(services);
  assert.equal(summary.label, 'Site institucional + Manutenção');
  assert.equal(summary.proposalScope, 'Escopo do site\n\nEscopo mensal');
  assert.equal(summary.contractScope, 'Contrato do site\n\nContrato mensal');
  assert.deepEqual(summary.tasks, ['Briefing', 'Design', 'Monitoramento']);
  assert.deepEqual(summary.responsible, ['Ana', 'Beto']);
  assert.equal(services.every((service) => service.price === ''), true);
});
