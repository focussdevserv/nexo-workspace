import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { planSiteMonitorConfiguration } from '../src/monitoring/site-monitor-config.ts';
import { isWorkspaceRequestAllowed } from '../src/security/authorization.ts';

const asset = { id: 'site-a', data: { name: 'Portal', clientId: 'client-a', url: 'https://example.test' } };

test('monitor configuration creates a linked schedule when the asset has none', () => {
  const plan = planSiteMonitorConfiguration(asset, [], true, 15, '2026-10-03T12:15:00.000Z');
  assert.equal(plan.canonicalId, null);
  assert.deepEqual(plan.duplicateIds, []);
  assert.deepEqual(plan.data, {
    siteAssetId: 'site-a', name: 'Portal', clientId: 'client-a', intervalMinutes: 15,
    enabled: true, nextCheckAt: '2026-10-03T12:15:00.000Z',
  });
});

test('monitor configuration selects an enabled canonical row and archives other linked rows', () => {
  const plan = planSiteMonitorConfiguration(asset, [
    { id: 'paused', data: { siteAssetId: 'site-a', enabled: false, intervalMinutes: 60, legacy: 'kept' } },
    { id: 'running', data: { siteAssetId: 'site-a', enabled: true, intervalMinutes: 5 } },
    { id: 'duplicate', data: { siteAssetId: 'site-a', enabled: true, intervalMinutes: 30 } },
  ], false, 30, null);
  assert.equal(plan.canonicalId, 'running');
  assert.deepEqual(plan.duplicateIds, ['paused', 'duplicate']);
  assert.equal(plan.data.enabled, false);
  assert.equal(plan.data.intervalMinutes, 30);
  assert.equal(plan.data.nextCheckAt, null);
  assert.equal(plan.data.legacy, undefined);
  assert.equal(plan.data.name, 'Portal');
});

test('site monitor configuration endpoint uses sites write authorization and an atomic scoped transaction', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/site-assets/:id/monitor'");
  const end = source.indexOf("app.post('/api/monitoring/site-assets/:id/check'", start);
  assert.ok(start >= 0 && end > start, 'monitor configuration route is registered before manual checks');
  const route = source.slice(start, end);
  assert.match(route, /intervalMinutes: z\.union\(\[z\.literal\(5\), z\.literal\(15\), z\.literal\(30\), z\.literal\(60\)\]\)/);
  assert.match(route, /isWorkspaceRequestAllowed\(request\.user\.role, 'POST', '\/api\/workspace\/site-assets'/);
  assert.match(route, /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\)/);
  assert.match(route, /recordMatchesWorkspaceScope\('site-assets'/);
  assert.match(route, /await db\.transaction\(async \(tx\)/);
  assert.match(route, /\.for\('update'\)/);
  assert.match(route, /planSiteMonitorConfiguration\(/);
  assert.match(route, /tx\.update\(workspaceRecords\)/);
  assert.match(route, /tx\.insert\(workspaceRecords\)/);
  assert.match(route, /tx\.insert\(activityEvents\)/);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/site-assets/00000000-0000-4000-8000-000000000001/monitor', { sites: { read: true, write: true } }), true);
  assert.equal(isWorkspaceRequestAllowed('member', 'POST', '/api/workspace/site-assets/00000000-0000-4000-8000-000000000001/monitor', { sites: { read: true, write: false } }), false);
});
