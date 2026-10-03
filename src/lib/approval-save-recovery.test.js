import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalWasRecoveredAfterSaveFailure, recoverApprovalShareAfterSaveFailure } from './approval-save-recovery.js';

const approval = { id: 'temporary-id', title: 'Homepage final', clientId: 'client-1', status: 'Aguardando', sent: '2026-10-03T12:00:00.000Z' };

test('recognizes a saved approval recovered from the server even when its server ID changed', () => {
  const saved = { ok: false, records: [{ ...approval, id: 'server-id' }] };
  assert.equal(approvalWasRecoveredAfterSaveFailure(saved, approval), true);
});

test('does not match a different approval using only title and client', () => {
  const saved = { ok: false, records: [{ ...approval, id: 'server-id', sent: '2026-10-03T12:01:00.000Z' }] };
  assert.equal(approvalWasRecoveredAfterSaveFailure(saved, approval), false);
});

test('keeps a newly shared file available when the approval was saved despite a lost response', async () => {
  let revokeCalls = 0;
  const result = await recoverApprovalShareAfterSaveFailure({
    saved: { ok: false, records: [{ ...approval, id: 'server-id' }] },
    approval,
    shared: { shared: true, created: true, permissionId: 'created-permission' },
  }, async () => { revokeCalls += 1; });
  assert.deepEqual(result, { approvalSaved: true, accessRevoked: false, accessMayRemain: false });
  assert.equal(revokeCalls, 0);
});

test('does not revoke file access when both the save and server-state recovery are uncertain', async () => {
  let revokeCalls = 0;
  const result = await recoverApprovalShareAfterSaveFailure({
    saved: { ok: false, recovered: false, records: [] },
    approval,
    shared: { shared: true, created: true, permissionId: 'created-permission' },
  }, async () => { revokeCalls += 1; });
  assert.deepEqual(result, { approvalSaved: false, accessRevoked: false, accessMayRemain: true, saveOutcomeUnknown: true });
  assert.equal(revokeCalls, 0);
});

test('revokes a permission created by this request when saving the approval failed', async () => {
  const saved = { ok: false, records: [] };
  let revoked = '';
  const result = await recoverApprovalShareAfterSaveFailure({ saved, approval, shared: { shared: true, created: true, permissionId: 'new-permission' } }, async (id) => { revoked = id; });
  assert.deepEqual(result, { approvalSaved: false, accessRevoked: true, accessMayRemain: false });
  assert.equal(revoked, 'new-permission');
});

test('does not revoke an existing public permission and reports that access remains', async () => {
  let revokeCalls = 0;
  const result = await recoverApprovalShareAfterSaveFailure({ saved: { ok: false, records: [] }, approval, shared: { shared: true, created: false, permissionId: null } }, async () => { revokeCalls += 1; });
  assert.deepEqual(result, { approvalSaved: false, accessRevoked: false, accessMayRemain: true });
  assert.equal(revokeCalls, 0);
});

test('reports failure to clean up a newly created public permission', async () => {
  const result = await recoverApprovalShareAfterSaveFailure({ saved: { ok: false, records: [] }, approval, shared: { shared: true, created: true, permissionId: 'new-permission' } }, async () => { throw new Error('Drive unavailable'); });
  assert.equal(result.approvalSaved, false);
  assert.equal(result.accessMayRemain, true);
  assert.match(result.cleanupError.message, /Drive unavailable/);
});
