import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveClientRecord, isArchivedClient, restoreClientRecord } from './client-archive.js';

test('archiving preserves client identity and history while marking it inactive', () => {
  const client = { id: 12, name: 'Acme', status: 'Ativo', notes: ['histórico'] };
  const archived = archiveClientRecord(client, '2026-10-02T12:00:00.000Z');
  assert.deepEqual(archived, { ...client, status: 'Inativo', archivedAt: '2026-10-02T12:00:00.000Z' });
  assert.equal(isArchivedClient(archived), true);
  assert.equal(client.status, 'Ativo');
});

test('restoring an archived client removes archive metadata and retains its data', () => {
  const client = { id: 12, name: 'Acme', status: 'Inativo', archivedAt: '2026-10-02T12:00:00.000Z', notes: ['histórico'] };
  const restored = restoreClientRecord(client);
  assert.deepEqual(restored, { id: 12, name: 'Acme', status: 'Ativo', notes: ['histórico'] });
  assert.equal(isArchivedClient(restored), false);
});
