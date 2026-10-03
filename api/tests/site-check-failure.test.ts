import assert from 'node:assert/strict';
import test from 'node:test';
import { siteCheckFailureData } from '../src/monitoring/site-check-failure.js';

test('scheduled monitoring failure clears stale success data but preserves asset metadata', () => {
  const previous = {
    name: 'Site principal', clientId: 'client-1', url: 'https://example.invalid',
    health: 'Online', status: 'Online', httpStatus: 200, latencyMs: 54,
    sslExpiresAt: '2027-01-01T00:00:00.000Z', checkedAt: '2026-10-01T10:00:00.000Z',
  };
  const failed = siteCheckFailureData(previous, '2026-10-02T10:00:00.000Z', 'check_failed');

  assert.equal(failed.name, previous.name);
  assert.equal(failed.clientId, previous.clientId);
  assert.equal(failed.health, 'Offline');
  assert.equal(failed.status, 'Offline');
  assert.equal(failed.httpStatus, null);
  assert.equal(failed.latencyMs, null);
  assert.equal(failed.sslExpiresAt, null);
  assert.equal(failed.checkedAt, '2026-10-02T10:00:00.000Z');
  assert.equal(failed.lastCheckErrorCode, 'check_failed');
});

test('manual and scheduled failures share the same stale-success clearing contract', () => {
  const previous = {
    name: 'Site principal', url: 'https://private.example', health: 'Online', status: 'Online',
    httpStatus: 200, latencyMs: 30, sslExpiresAt: '2027-01-01T00:00:00.000Z', checkedAt: '2026-10-01T10:00:00.000Z',
  };
  for (const reason of ['host_not_public', 'invalid_url', 'check_failed'] as const) {
    const failed = siteCheckFailureData(previous, '2026-10-02T10:00:00.000Z', reason);
    assert.equal(failed.health, 'Offline', reason);
    assert.equal(failed.status, 'Offline', reason);
    assert.equal(failed.httpStatus, null, reason);
    assert.equal(failed.latencyMs, null, reason);
    assert.equal(failed.sslExpiresAt, null, reason);
    assert.equal(failed.lastCheckErrorCode, reason);
  }
});
