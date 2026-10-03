import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBelongsToPortalClient } from '../src/security/client-portal-record-scope.js';

test('portal record scope accepts each supported client reference field', () => {
  for (const field of [
    'clientId', 'workspaceClientId', 'clientRecordId', 'client_id', 'workspace_client_id', 'client_record_id',
    'companyId', 'workspaceCompanyId', 'companyRecordId', 'company_id', 'workspace_company_id', 'company_record_id',
    'customerId', 'workspaceCustomerId', 'customerRecordId', 'customer_id', 'workspace_customer_id', 'customer_record_id',
  ]) {
    assert.equal(recordBelongsToPortalClient({ [field]: 'client-a' }, 'client-a'), true, field);
  }
});

test('portal record scope rejects unrelated or malformed client references', () => {
  assert.equal(recordBelongsToPortalClient({ clientId: 'client-b' }, 'client-a'), false);
  assert.equal(recordBelongsToPortalClient({ workspaceClientId: 'client-b', clientRecordId: 'client-a' }, 'client-a'), false);
  assert.equal(recordBelongsToPortalClient({ clientId: 42 }, '42'), false);
  assert.equal(recordBelongsToPortalClient({}, 'client-a'), false);
});
