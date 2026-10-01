import assert from 'node:assert/strict';
import test from 'node:test';
import { isWorkspaceRequestAllowed } from '../src/security/authorization.ts';

test('owners retain access to all workspace routes', () => {
  assert.equal(isWorkspaceRequestAllowed('owner', 'DELETE', '/api/billing/orders/1'), true);
  assert.equal(isWorkspaceRequestAllowed('owner', 'GET', '/api/workspace/backup'), true);
  assert.equal(isWorkspaceRequestAllowed('owner', 'POST', '/api/workspace/backup/restore'), true);
});

test('workspace backups are restricted to the owner even when members have broad module grants', () => {
  const broad = { settings: { read: true, write: true, delete: true } };
  assert.equal(isWorkspaceRequestAllowed('admin', 'GET', '/api/workspace/backup'), false);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/workspace/backup/restore'), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/backup', broad), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/backup/restore', broad), false);
});

test('admins can run agency workflows but cannot manage accounts or integrations', () => {
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/workspace/projects'), true);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/integrations/waha/send'), true);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/team/invites'), false);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/integrations/mercadopago/connection'), false);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/integrations/waha/sessions'), false);
});

test('members can work on delivery and respond through connected inbox channels', () => {
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/assignees'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/assignees'), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/preferences'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/preferences'), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/projects?limit=20'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'PATCH', '/api/workspace/tasks/123'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/approvals'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/files'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/integrations/google/calendar/events'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'PATCH', '/api/integrations/google/calendar/events'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/integrations/waha/sessions'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/integrations/google/gmail/send'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/integrations/waha/send'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/integrations/google/gmail/thread-1/reply'), true);
});

test('members cannot access billing, settings, identity, or integration controls', () => {
  for (const [method, path] of [
    ['GET', '/api/workspace/finance-accounts'], ['POST', '/api/workspace/revenues'],
    ['PATCH', '/api/workspace/clients/123'], ['DELETE', '/api/workspace/contracts/123'],
    ['GET', '/api/integrations/status'], ['POST', '/api/integrations/google/authorize'],
    ['POST', '/api/billing/orders'], ['GET', '/api/team/users'],
  ] as const) assert.equal(isWorkspaceRequestAllowed('member', method, path), false, `${method} ${path}`);
});

test('members only mark their notifications read and cannot perform arbitrary actions', () => {
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/notifications/read'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'DELETE', '/api/notifications/123'), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/automations'), false);
});

test('workspace module permissions can restrict or grant access within their module', () => {
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/billing/orders', { finance: { read: true, write: false } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/clients', { crm: { read: true, write: true } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/clients', { crm: { read: false, write: true } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/revenues', { finance: { read: true, write: false } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/revenues', { finance: { read: true, write: false } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/revenues/recurring', { finance: { read: true, write: true } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/expenses/recurring', { finance: { read: true, write: false } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/repositories', { sites: { read: true, write: false } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/assignees', { support: { read: true, write: true } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'DELETE', '/api/workspace/tasks/123'), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'DELETE', '/api/workspace/tasks/123', { delivery: { read: true, write: true } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'DELETE', '/api/workspace/tasks/123', { delivery: { read: true, write: true, delete: false } }), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'DELETE', '/api/workspace/tasks/123', { delivery: { read: true, write: true, delete: true } }), true);
});

test('module permissions cannot grant account administration or provider credential controls', () => {
  const all = Object.fromEntries(['crm', 'delivery', 'support', 'finance', 'automations', 'integrations', 'settings', 'reports'].map((module) => [module, { read: true, write: true }]));
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/team/invites', all), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/integrations/google/authorize', all), false);
  assert.equal(isWorkspaceRequestAllowed('admin', 'POST', '/api/integrations/mercadopago/connection', all), false);
});

test('selected client scope blocks the legacy unlinked client API', () => {
  const scoped = { crm: { read: true, write: true, delete: true }, scope: { mode: 'selected' as const, clientIds: ['client-id'], projectIds: [] } };
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/clients', scoped), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'PATCH', '/api/clients/legacy-id', scoped), false);
  assert.equal(isWorkspaceRequestAllowed('member', 'GET', '/api/workspace/clients', scoped), true);
});
