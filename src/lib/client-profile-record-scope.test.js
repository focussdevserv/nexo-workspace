import test from 'node:test';
import assert from 'node:assert/strict';
import { belongsToClientProfileRecord } from './client-profile-record-scope.js';

const client = { id: 'client-1', name: 'Acme' };

test('client profile requires every explicit client ID alias to agree', () => {
  assert.equal(belongsToClientProfileRecord({ workspaceClientId: 'client-1' }, client), true);
  assert.equal(belongsToClientProfileRecord({ clientId: 'client-1', clientRecordId: 'client-1' }, client), true);
  assert.equal(belongsToClientProfileRecord({ workspaceClientId: 'client-1', clientId: 'client-2' }, client), false);
  assert.equal(belongsToClientProfileRecord({ clientId: 'client-1', clientRecordId: 'client-2' }, client), false);
});

test('client profile rejects foreign snake-case and legacy company/customer IDs before name fallback', () => {
  for (const field of [
    'client_id', 'workspace_client_id', 'client_record_id',
    'companyId', 'workspaceCompanyId', 'companyRecordId',
    'company_id', 'workspace_company_id', 'company_record_id',
    'customerId', 'workspaceCustomerId', 'customerRecordId',
    'customer_id', 'workspace_customer_id', 'customer_record_id',
  ]) {
    assert.equal(belongsToClientProfileRecord({ [field]: 'client-2', client: 'Acme' }, client, 'Acme'), false, field);
  }
});

test('client profile keeps legacy name matching only when no explicit client ID exists', () => {
  assert.equal(belongsToClientProfileRecord({ client: 'Acme' }, client, 'Acme'), true);
  assert.equal(belongsToClientProfileRecord({ client: 'Acme', clientId: 'client-2' }, client, 'Acme'), false);
});
