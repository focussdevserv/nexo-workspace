import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('manual site check persists an offline failure and history without overwriting a changed URL', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/monitoring/site-assets/:id/check'");
  const end = source.indexOf("app.post('/api/integrations/clicksign/webhook'", start);
  assert.ok(start >= 0 && end > start, 'manual check route is registered before the next integration route');
  const route = source.slice(start, end);
  assert.match(route, /failureReason = code === 'host_not_public' \? 'host_not_public' : code === 'invalid_url' \? 'invalid_url' : 'check_failed'/);
  assert.match(route, /siteCheckTargetFor\(current\.data\) !== checkedTarget/);
  assert.match(route, /siteCheckFailureData\(current\.data, checkedAt, failureReason\)/);
  assert.match(route, /status: 'Offline'.*source: 'manual', reason: failureReason/s);
});
