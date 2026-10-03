import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sourcePromise = readFile(new URL('../src/server.ts', import.meta.url), 'utf8');

test('project creation only links an active client in the same organization and permitted scope', async () => {
  const source = await sourcePromise;
  const start = source.indexOf("app.post('/api/workspace/:resource'");
  const end = source.indexOf("app.patch('/api/workspace/:resource/:id'", start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /params\.data\.resource === 'projects'.*body\.data\.clientId/s);
  assert.match(route, /z\.string\(\)\.uuid\(\)\.safeParse\(body\.data\.clientId\)/);
  assert.match(route, /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)/);
  assert.match(route, /eq\(workspaceRecords\.resource, 'clients'\), isNull\(workspaceRecords\.archivedAt\)/);
  assert.match(route, /\.for\('share'\)\.limit\(1\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('clients', linkedClient\.id, linkedClient\.data, recordScope\)/);
  assert.match(route, /projectClientMissing/);
  assert.match(route, /projectClientScopeDenied/);
});

test('project edits validate changed client links in-transaction and enforce member scope', async () => {
  const source = await sourcePromise;
  const start = source.indexOf("app.patch('/api/workspace/:resource/:id'");
  const end = source.indexOf("app.delete('/api/workspace/finance-accounts/:id'", start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /params\.data\.resource === 'projects' && Object\.hasOwn\(body\.data, 'clientId'\)/);
  assert.match(route, /z\.string\(\)\.uuid\(\)\.safeParse\(body\.data\.clientId\)/);
  assert.match(route, /eq\(workspaceRecords\.id, projectClientPatch\.data\), eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)/);
  assert.match(route, /eq\(workspaceRecords\.resource, 'clients'\), isNull\(workspaceRecords\.archivedAt\)/);
  assert.match(route, /\.for\('share'\)\.limit\(1\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('clients', linkedClient\.id, linkedClient\.data, request\.user\.permissions\?\.scope\)/);
  assert.match(route, /if \(projectClientMissing\) return reply\.code\(400\)/);
  assert.match(route, /if \(projectClientScopeDenied\) return reply\.code\(403\)/);
});
