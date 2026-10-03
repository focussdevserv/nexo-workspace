import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { billingClientIdsForWorkspaceScope, recordMatchesWorkspaceScope, rememberWorkspaceProjectClientLinks, selectedWorkspaceProjectClientLinks } from '../src/security/record-scope.ts';

const scope = { mode: 'selected' as const, clientIds: ['client-a'], projectIds: ['project-b'] };

test('selected client and project scopes include only linked records', () => {
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-a', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-x', {}, scope), false);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-b', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-x', { clientId: 'client-a' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-a', { projectId: 'project-b' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-x', { projectId: 'project-x' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-unlinked', {}, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-conflicting-client', { projectId: 'project-b', clientId: 'client-x' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-conflicting-alias', { clientId: 'client-a', workspaceClientId: 'client-x' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-conflicting-project-alias', { clientId: 'client-a', projectId: 'project-b', sourceProjectId: 'project-x' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-numeric-project', { clientId: 'client-a', projectId: 42 }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-object-client', { clientId: { id: 'client-a' }, projectId: 'project-b' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('tickets', 'ticket-a', { workspaceClientId: 'client-a' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tickets', 'ticket-x', { client: 'Same visible name' }, scope), false);
});

test('selected client scope leaves resources without client links untouched', () => {
  assert.equal(recordMatchesWorkspaceScope('settings', 'setting-a', { companyId: 'client-outside' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('notifications', 'notice-a', { project_id: 'project-outside' }, scope), true);
});

test('alternate tenant relationship aliases cannot bypass selected scope', () => {
  const clientAliases = [
    'client_id', 'workspace_client_id', 'client_record_id', 'companyId', 'workspaceCompanyId',
    'companyRecordId', 'company_id', 'workspace_company_id', 'company_record_id', 'customerId',
    'workspaceCustomerId', 'customerRecordId', 'customer_id', 'workspace_customer_id', 'customer_record_id',
  ];
  for (const field of clientAliases) {
    assert.equal(recordMatchesWorkspaceScope('tickets', `linked-${field}`, { [field]: 'client-a' }, scope), true, field);
    assert.equal(recordMatchesWorkspaceScope('tickets', `foreign-${field}`, { [field]: 'client-x' }, scope), false, field);
    assert.equal(recordMatchesWorkspaceScope('tickets', `conflict-${field}`, { clientId: 'client-a', [field]: 'client-x' }, scope), false, field);
  }

  const projectAliases = ['workspaceProjectId', 'projectRecordId', 'project_id', 'source_project_id', 'workspace_project_id', 'project_record_id'];
  for (const field of projectAliases) {
    assert.equal(recordMatchesWorkspaceScope('tickets', `linked-${field}`, { [field]: 'project-b' }, scope), true, field);
    assert.equal(recordMatchesWorkspaceScope('tickets', `foreign-${field}`, { [field]: 'project-x' }, scope), false, field);
    assert.equal(recordMatchesWorkspaceScope('tickets', `conflict-${field}`, { projectId: 'project-b', [field]: 'project-x' }, scope), false, field);
  }
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-b', { company_id: 'client-x' }, scope), false);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-x', { customer_id: 'client-a' }, scope), true);
});

test('unrelated workspace configuration stays shared while all scope preserves legacy access', () => {
  assert.equal(recordMatchesWorkspaceScope('services', 'service-x', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('finance-accounts', 'account-x', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('leads', 'lead-x', {}, { ...scope, mode: 'all' }), true);
});

test('billing scope includes assigned clients and clients attached to assigned projects only', () => {
  assert.deepEqual(billingClientIdsForWorkspaceScope(scope, [
    { id: 'project-b', data: { company_id: 'client-from-project' } },
    { id: 'project-x', data: { clientId: 'unassigned-client' } },
  ]), ['client-a', 'client-from-project']);
  assert.deepEqual(billingClientIdsForWorkspaceScope({ ...scope, clientIds: [], projectIds: [] }, []), []);
  assert.equal(billingClientIdsForWorkspaceScope({ ...scope, mode: 'all' }, []), null);
  assert.deepEqual(billingClientIdsForWorkspaceScope({ ...scope, clientIds: [], projectIds: ['project-b'] }, [
    { id: 'project-b', data: { clientId: 'client-b', company_id: 'foreign-client' } },
  ]), []);
});

test('selected project scope inherits only its canonical client link for projects and linked records', () => {
  const projectScope = { mode: 'selected' as const, clientIds: [], projectIds: ['project-b'] };
  const links = [{ id: 'project-b', data: { clientId: 'client-b' } }, { id: 'project-x', data: { clientId: 'client-x' } }];
  assert.deepEqual([...selectedWorkspaceProjectClientLinks(projectScope, links)], [['project-b', 'client-b']]);
  rememberWorkspaceProjectClientLinks(projectScope, links);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-b', { clientId: 'client-b' }, projectScope), true);
  assert.equal(recordMatchesWorkspaceScope('files', 'file-b', { projectId: 'project-b', clientId: 'client-b' }, projectScope), true);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-b', { projectId: 'project-b', clientId: 'client-x' }, projectScope), false);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-x', { projectId: 'project-x', clientId: 'client-b' }, projectScope), false);
});

test('ambiguous and malformed project-to-client aliases never create inherited access', () => {
  const projectScope = { mode: 'selected' as const, clientIds: [], projectIds: ['project-b'] };
  const projects = [
    { id: 'project-b', data: { clientId: 'client-b', company_id: 'client-x' } },
    { id: 'project-b', data: { clientId: { id: 'client-b' } } },
  ];
  assert.deepEqual([...selectedWorkspaceProjectClientLinks(projectScope, projects)], []);
  rememberWorkspaceProjectClientLinks(projectScope, projects);
  assert.equal(recordMatchesWorkspaceScope('files', 'file-b', { projectId: 'project-b', clientId: 'client-b' }, projectScope), false);
});

test('the SQL list predicate rejects conflicting legacy aliases just like record-level scope checks', async () => {
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const predicate = server.match(/function workspaceRecordScopeWhere\([\s\S]*?\n\}/)?.[0] || '';
  assert.match(predicate, /consistentReferenceConditions\(clientFields\)/);
  assert.match(predicate, /scopedReferenceConditions\(projectFields, projectIds\)/);
  assert.match(predicate, /canonicalReference = sql`coalesce/);
  assert.match(predicate, /eq\(reference, canonicalReference\)/);
});
