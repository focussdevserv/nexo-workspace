import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionDraftForAccount, permissionsPayload, setModulePermissionMode, validatePermissionDraft } from './team-permissions.js';

const modules = ['crm', 'delivery', 'finance'];

test('editing a legacy role leaves unspecified modules inherited instead of granting module-wide access', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: { delivery: { read: true, write: true } } }, modules);
  assert.equal(draft.crm, null);
  assert.deepEqual(draft.delivery, { read: true, write: true, delete: false });
  assert.equal(draft.finance, null);
  assert.deepEqual(permissionsPayload(draft, modules), {
    delivery: { read: true, write: true, delete: false },
    scope: { mode: 'all', clientIds: [], projectIds: [] },
  });
});

test('selected record scope needs at least one record and explicit mutations require read access', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: {} }, modules);
  draft.finance = { read: false, write: true, delete: false };
  assert.match(validatePermissionDraft(draft, modules), /precisam incluir leitura/);
  draft.finance = { read: true, write: false, delete: false };
  draft.scope.mode = 'selected';
  assert.match(validatePermissionDraft(draft, modules), /Selecione ao menos/);
  draft.scope.clientIds = ['client-1'];
  assert.equal(validatePermissionDraft(draft, modules), '');
});

test('permission payload keeps selected client and project scope without granting unspecified modules', () => {
  const draft = permissionDraftForAccount({ permissions: { crm: { read: true } } }, modules);
  draft.scope = { mode: 'selected', clientIds: ['client-1'], projectIds: ['project-2'] };
  assert.deepEqual(permissionsPayload(draft, modules), {
    crm: { read: true, write: false, delete: false },
    scope: { mode: 'selected', clientIds: ['client-1'], projectIds: ['project-2'] },
  });
});

test('an inherited module can be explicitly blocked and restored to role defaults', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: null }, modules);
  const blocked = setModulePermissionMode(draft, 'crm', 'blocked');

  assert.deepEqual(permissionsPayload(blocked, modules).crm, { read: false, write: false, delete: false });
  const inheritedAgain = setModulePermissionMode(blocked, 'crm', 'inherited');
  assert.equal(inheritedAgain.crm, null);
  assert.equal(Object.hasOwn(permissionsPayload(inheritedAgain, modules), 'crm'), false);
});
