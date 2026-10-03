import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isWorkspaceRequestAllowed } from '../src/security/authorization.ts';

test('project creation and template tasks are written atomically and replay safely', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/projects/with-tasks'");
  const end = source.indexOf("app.post('/api/workspace/:resource'", start);
  assert.ok(start >= 0 && end > start, 'project bundle route is registered before generic workspace creation');
  const route = source.slice(start, end);
  assert.match(route, /requestId: z\.string\(\)\.uuid\(\)/);
  assert.match(route, /isWorkspaceRequestAllowed\(request\.user\.role, 'POST', '\/api\/workspace\/projects'/);
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /requestHash/);
  assert.match(route, /project_bundle_created/);
  assert.match(route, /await db\.transaction\(async \(tx\)/);
  assert.match(route, /tx\.insert\(workspaceRecords\)\.values\(\{[\s\S]*?resource: 'projects'/);
  assert.match(route, /tx\.insert\(workspaceRecords\)\.values\(taskValues\)/);
  assert.match(route, /tx\.insert\(activityEvents\)\.values\(/);
  assert.match(route, /recordMatchesWorkspaceScope\('projects'/);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/projects/with-tasks', { delivery: { read: true, write: true } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/projects/with-tasks', { delivery: { read: true, write: false } }), false);
});

test('production project composer uses the atomic route and retains the request ID for unchanged retries', async () => {
  const source = await readFile(new URL('../../src/screens/WorkScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const saveProjectComposer = async () =>');
  const end = source.indexOf('const saveTaskComposer = async () =>', start);
  assert.ok(start >= 0 && end > start, 'project composer exists');
  const composer = source.slice(start, end);
  assert.match(composer, /if \(!localDemo\)/);
  assert.match(composer, /projectCreateAttemptRef\.current\?\.fingerprint !== fingerprint/);
  assert.match(composer, /requestId: createRequestUuid\(\)/);
  assert.match(composer, /requestId: projectCreateAttemptRef\.current\.requestId/);
  assert.match(composer, /map\(\(\{ id, \.\.\.task \}\) => \(\{ \.\.\.task, projectId: '' \}\)\)/);
  assert.match(composer, /apiRequest\('\/api\/workspace\/projects\/with-tasks'/);
  assert.match(composer, /projectCreateAttemptRef\.current = null/);
  assert.match(composer, /Promise\.all\(\[refreshProjects\(\), refreshTasks\(\)\]\)/);
});
