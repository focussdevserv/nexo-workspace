import test from 'node:test';
import assert from 'node:assert/strict';
import { roleCanOpenWorkspacePage, workspacePagePermissionModule } from './workspace-page-access.js';

test('client portal administration follows CRM permissions, matching its client API routes', () => {
  assert.equal(workspacePagePermissionModule('Portal do cliente'), 'crm');
  assert.equal(roleCanOpenWorkspacePage('member', 'Portal do cliente', { support: { read: true }, crm: { read: false } }), false);
  assert.equal(roleCanOpenWorkspacePage('member', 'Portal do cliente', { support: { read: false }, crm: { read: true } }), true);
});

test('member navigation honors explicit module read permissions and safe baseline pages', () => {
  assert.equal(roleCanOpenWorkspacePage('member', 'Clientes', { crm: { read: true } }), true);
  assert.equal(roleCanOpenWorkspacePage('member', 'Clientes', { crm: { read: false } }), false);
  assert.equal(roleCanOpenWorkspacePage('member', 'Meu Dia'), true);
  assert.equal(roleCanOpenWorkspacePage('member', 'Financeiro'), false);
});

test('team administration remains owner-only and unknown roles cannot navigate', () => {
  assert.equal(roleCanOpenWorkspacePage('owner', 'Equipe'), true);
  assert.equal(roleCanOpenWorkspacePage('admin', 'Equipe'), false);
  assert.equal(roleCanOpenWorkspacePage('guest', 'Meu Dia'), false);
});
