import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('revenue and expense creation validates linked client identity within the active organization', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/:resource'");
  const end = source.indexOf("app.patch('/api/workspace/:resource/:id'", start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /\['revenues', 'expenses'\]\.includes\(params\.data\.resource\)/);
  assert.match(route, /z\.string\(\)\.uuid\(\)\.safeParse\(body\.data\.clientId\)/);
  assert.match(route, /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)/);
  assert.match(route, /eq\(workspaceRecords\.resource, 'clients'\), isNull\(workspaceRecords\.archivedAt\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('clients', client\.id/);
});

test('editing a revenue or expense cannot attach it to a missing or out-of-scope client', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.patch('/api/workspace/:resource/:id'");
  const end = source.indexOf("app.delete('/api/workspace/finance-accounts/:id'", start);
  const route = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /\['revenues', 'expenses'\]\.includes\(params\.data\.resource\)/);
  assert.match(route, /Object\.hasOwn\(body\.data, 'clientId'\)/);
  assert.match(route, /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)/);
  assert.match(route, /eq\(workspaceRecords\.resource, 'clients'\), isNull\(workspaceRecords\.archivedAt\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('clients', client\.id/);
});
