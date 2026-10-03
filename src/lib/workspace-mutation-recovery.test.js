import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverWorkspaceRecordsAfterFailure } from './workspace-mutation-recovery.js';

test('recovers the authoritative workspace snapshot after a partial multi-record save', async () => {
  const savedOnServer = [{ id: 'server-1', title: 'Persistiu antes da falha' }];
  const requested = [];
  const result = await recoverWorkspaceRecordsAfterFailure(async (path) => {
    requested.push(path);
    return savedOnServer;
  }, 'tasks', [{ id: 'temporary-1', title: 'Estado otimista' }]);

  assert.deepEqual(requested, ['/api/workspace/tasks']);
  assert.deepEqual(result, { records: savedOnServer, recovered: true });
});

test('uses the supplied fallback only when the workspace cannot be reloaded', async () => {
  const fallback = [{ id: 'stable', title: 'Estado anterior' }];
  const result = await recoverWorkspaceRecordsAfterFailure(async () => { throw new Error('offline'); }, 'projects', fallback);

  assert.equal(result.records, fallback);
  assert.equal(result.recovered, false);
  assert.equal(result.recoveryError.message, 'offline');
});

test('rejects a malformed recovery response instead of replacing records with an unknown shape', async () => {
  const fallback = [{ id: 'stable' }];
  const result = await recoverWorkspaceRecordsAfterFailure(async () => ({ data: [] }), 'files', fallback);

  assert.equal(result.records, fallback);
  assert.equal(result.recovered, false);
});
