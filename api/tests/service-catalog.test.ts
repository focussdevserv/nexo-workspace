import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeRequestedServiceCatalog, mergeRequestedServiceCatalog, requestedServiceCatalog } from '../../src/data/service-catalog.js';

test('repairs templates for the supplied catalog without duplicating or inventing prices', () => {
  const existing = requestedServiceCatalog.map((item, index) => ({
    id: `service-${index}`,
    ...item,
    proposalTemplate: '',
    contractTemplate: undefined,
    templateTasks: [],
    price: '',
  }));
  const completed = completeRequestedServiceCatalog(existing);

  assert.equal(requestedServiceCatalog.length, 88);
  assert.equal(mergeRequestedServiceCatalog(existing).length, 0);
  assert.equal(completed.length, existing.length);
  assert.equal(completed.filter((item) => item.proposalTemplate).length, 88);
  assert.equal(completed.filter((item) => item.contractTemplate).length, 88);
  assert.equal(completed.filter((item) => item.templateTasks?.length).length, 88);
  assert.equal(completed.filter((item) => item.price).length, 0);
  assert.equal(completed[0]?.id, existing[0]?.id);
});

test('preserves configured commercial values and custom templates', () => {
  const custom = {
    ...requestedServiceCatalog[0],
    id: 'configured-service',
    price: 'R$ 1.500',
    description: 'Escopo revisado pela equipe',
    proposalTemplate: 'Escopo comercial customizado',
  };
  const [completed] = completeRequestedServiceCatalog([custom]);

  assert.equal(completed?.price, custom.price);
  assert.equal(completed?.description, custom.description);
  assert.equal(completed?.proposalTemplate, custom.proposalTemplate);
  assert.ok(completed?.contractTemplate);
});
