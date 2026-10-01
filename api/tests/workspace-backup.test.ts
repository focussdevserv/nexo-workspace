import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkspaceBackup, parseWorkspaceBackup } from '../src/workspace-backup.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const recordId = '00000000-0000-4000-8000-000000000002';
const now = new Date('2026-10-01T12:00:00.000Z');

test('exports workspace content while excluding integration secrets and unsafe records', () => {
  const backup = buildWorkspaceBackup({
    organizationId,
    records: [
      { id: recordId, resource: 'clients', data: { name: 'Cliente exemplo' }, createdAt: now, updatedAt: now, archivedAt: null },
      { id: '00000000-0000-4000-8000-000000000003', resource: 'integration-secrets', data: { apiKey: 'never-export' }, createdAt: now, updatedAt: now, archivedAt: null },
      { id: '00000000-0000-4000-8000-000000000004', resource: 'integration-controls', data: { connected: true }, createdAt: now, updatedAt: now, archivedAt: null },
      { id: '00000000-0000-4000-8000-000000000005', resource: 'settings', data: { nested: { accessToken: 'never-export' } }, createdAt: now, updatedAt: now, archivedAt: null },
      { id: '00000000-0000-4000-8000-000000000007', resource: 'portal-auth-challenges', data: { challengeHash: 'never-export' }, createdAt: now, updatedAt: now, archivedAt: null },
    ], clients: [], billingOrders: [{
      id: '00000000-0000-4000-8000-000000000006', clientId: null, workspaceClientId: null, clientName: 'Cliente', payerEmail: 'cliente@example.com', description: 'Mensalidade', amount: 100,
      method: 'pix', status: 'pending', statusDetail: null, mpOrderId: null, mpPaymentId: null, paymentDetails: { token: 'never-export' }, dueAt: null, createdAt: now, updatedAt: now,
    }], billingSubscriptions: [],
  });
  assert.equal(backup.records.length, 1);
  assert.equal(backup.excludedRecords, 5);
  assert.deepEqual(backup.billingOrders[0]?.paymentDetails, {});
  assert.equal(JSON.stringify(backup).includes('never-export'), false);
});

test('imports only version 1 backups created for the current organization', () => {
  const backup = buildWorkspaceBackup({ organizationId, records: [], clients: [], billingOrders: [], billingSubscriptions: [] });
  assert.equal(parseWorkspaceBackup(backup, organizationId).version, 1);
  assert.throws(() => parseWorkspaceBackup(backup, '00000000-0000-4000-8000-000000000009'), /outro workspace/);
  assert.throws(() => parseWorkspaceBackup({ ...backup, version: 2 }, organizationId));
});

test('rejects credential fields in imported workspace records', () => {
  const backup = buildWorkspaceBackup({ organizationId, records: [], clients: [], billingOrders: [], billingSubscriptions: [] });
  const unsafe = { ...backup, records: [{ id: recordId, resource: 'settings', data: { secret: 'nope' }, createdAt: now.toISOString(), updatedAt: now.toISOString(), archivedAt: null }] };
  assert.throws(() => parseWorkspaceBackup(unsafe, organizationId));
});

test('rejects duplicate ids inside each restored table', () => {
  const backup = buildWorkspaceBackup({ organizationId, records: [], clients: [], billingOrders: [], billingSubscriptions: [] });
  const row = { id: recordId, resource: 'clients', data: { name: 'A' }, createdAt: now.toISOString(), updatedAt: now.toISOString(), archivedAt: null };
  assert.throws(() => parseWorkspaceBackup({ ...backup, records: [row, row] }, organizationId), /IDs duplicados/);
});
