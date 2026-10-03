import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialStatusPatch } from './commercial-status-patch.js';

test('saving a contract status also persists the edited contract document', () => {
  assert.deepEqual(commercialStatusPatch('contratos', 'Rascunho', 'Texto revisado'), {
    status: 'Rascunho', tone: 'amber', documentText: 'Texto revisado',
  });
});

test('contract metadata edits omit an unchanged document managed by signature provider', () => {
  assert.deepEqual(commercialStatusPatch('contratos', 'Assinado', 'Generated fallback', { includeContractDocument: false }), {
    status: 'Assinado', tone: 'green',
  });
});

test('status updates for other CRM records do not include contract fields', () => {
  assert.deepEqual(commercialStatusPatch('propostas', 'Enviada', ''), {
    status: 'Enviada', tone: 'amber',
  });
});

test('lead stage edits use the pipeline field and can trigger lead conversion', () => {
  assert.deepEqual(commercialStatusPatch('leads', 'Fechado'), {
    stage: 'Fechado', tone: 'green',
  });
});
