import assert from 'node:assert/strict';
import test from 'node:test';
import { siteCheckResultData, siteCheckResultMatchesAsset, siteCheckTargetFor } from '../src/monitoring/site-check-result.js';

const result = {
  url: 'https://example.com/', status: 'Online' as const, httpStatus: 200,
  latencyMs: 42, sslExpiresAt: '2027-01-01T00:00:00.000Z', checkedAt: '2026-10-03T12:00:00.000Z',
};

test('matches a normalized bare domain to the URL returned by the probe', () => {
  assert.equal(siteCheckTargetFor({ url: 'example.com' }), result.url);
  assert.equal(siteCheckResultMatchesAsset({ url: 'example.com' }, result), true);
});

test('rejects a probe result when the asset URL changed while the check ran', () => {
  assert.equal(siteCheckResultMatchesAsset({ url: 'https://new.example.com/' }, result), false);
  assert.equal(siteCheckResultMatchesAsset({ url: 'https://user:secret@example.com/' }, result), false);
});

test('merges probe fields into the latest asset without discarding edits', () => {
  const latest = { name: 'Renamed site', url: result.url, renewalDate: '2027-03-01', health: 'Offline', lastCheckErrorCode: 'check_failed' };
  const merged = siteCheckResultData(latest, result);
  assert.equal(merged.name, latest.name);
  assert.equal(merged.renewalDate, latest.renewalDate);
  assert.equal(merged.health, 'Online');
  assert.equal(merged.lastCheckErrorCode, undefined);
});
