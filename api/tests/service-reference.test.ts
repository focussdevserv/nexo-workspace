import test from 'node:test';
import assert from 'node:assert/strict';
import { detachCatalogServiceReference } from '../src/crm/service-reference.js';

test('detaches a deleted catalog service from a proposal while preserving its text snapshot', () => {
  const proposal = { serviceId: 'service-a', serviceIds: ['service-a', 'service-b'], service: 'Site + SEO', amount: 2400 };
  assert.deepEqual(detachCatalogServiceReference(proposal, 'service-a'), {
    serviceIds: ['service-b'], service: 'Site + SEO', amount: 2400,
  });
});

test('detaches legacy single service IDs and preserves all unrelated contract data', () => {
  const contract = { serviceId: 'service-a', service: 'Identidade visual', scope: 'Entrega de marca', status: 'Ativo' };
  assert.deepEqual(detachCatalogServiceReference(contract, 'service-a'), {
    service: 'Identidade visual', scope: 'Entrega de marca', status: 'Ativo',
  });
});

test('leaves unrelated records unchanged and safely handles records without a single service ID', () => {
  const proposal = { serviceId: 'service-b', serviceIds: ['service-b'], service: 'SEO' };
  assert.equal(detachCatalogServiceReference(proposal, 'service-a'), proposal);
  assert.equal(detachCatalogServiceReference({ service: 'Serviço manual' }, 'service-a').service, 'Serviço manual');
});
