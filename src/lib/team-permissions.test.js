import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveModulePermissionDraft, inheritedModulePermissions, permissionDraftForAccount, permissionsPayload, setModulePermissionMode, setModulePermissionValue, validatePermissionDraft } from './team-permissions.js';

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

test('inherited controls display effective permissions for both workspace roles', () => {
  assert.deepEqual(inheritedModulePermissions('admin', 'finance'), { read: true, write: true, delete: true });
  assert.deepEqual(inheritedModulePermissions('member', 'delivery'), { read: true, write: true, delete: null });
  assert.deepEqual(inheritedModulePermissions('member', 'crm'), { read: null, write: false, delete: false });
  assert.deepEqual(inheritedModulePermissions('member', 'finance'), { read: false, write: false, delete: false });

  const draft = permissionDraftForAccount({ role: 'member', permissions: null }, modules);
  assert.equal(draft.finance, null);
  assert.deepEqual(effectiveModulePermissionDraft(draft, 'member', 'finance'), { read: false, write: false, delete: false });
});

test('changing one inherited permission preserves the other effective role defaults', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: null }, modules);
  const changed = setModulePermissionValue(draft, 'member', 'delivery', 'write', false);

  assert.deepEqual(changed.delivery, { read: true, write: false, delete: false });
  assert.deepEqual(permissionsPayload(changed, modules).delivery, { read: true, write: false, delete: false });
  assert.equal(changed.crm, null);
});

test('a mixed inherited permission becomes an explicit uniform setting only after user interaction', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: null }, modules);
  assert.equal(effectiveModulePermissionDraft(draft, 'member', 'delivery').delete, null);

  const changed = setModulePermissionValue(draft, 'member', 'delivery', 'delete', true);
  assert.deepEqual(changed.delivery, { read: true, write: true, delete: true });
});

test('enabling an inherited edit permission grants its required read level', () => {
  const draft = permissionDraftForAccount({ role: 'member', permissions: null }, modules);
  const changed = setModulePermissionValue(draft, 'member', 'finance', 'write', true);

  assert.deepEqual(changed.finance, { read: true, write: true, delete: false });
  assert.equal(validatePermissionDraft(changed, modules), '');
});
