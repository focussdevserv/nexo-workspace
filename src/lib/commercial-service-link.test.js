import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCommercialServiceByName } from './commercial-service-link.js';

test('resolves a catalog service by a normalized unique name', () => {
  const service = { id: 7, name: 'Landing Page' };
  assert.deepEqual(resolveCommercialServiceByName([service], ' landing page '), {
    service,
    ambiguous: false,
  });
});

test('does not choose the first of duplicate service names', () => {
  const services = [{ id: 'a', name: 'Landing Page' }, { id: 'b', name: ' landing page ' }];
  assert.deepEqual(resolveCommercialServiceByName(services, 'LANDING PAGE'), {
    service: null,
    ambiguous: true,
  });
});
