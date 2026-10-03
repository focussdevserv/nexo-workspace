import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRepositoryActivity } from './repository-activity.js';

test('normalizes a partial GitHub activity response without losing valid data', () => {
  assert.deepEqual(normalizeRepositoryActivity({
    repository: { fullName: 'acme/site', url: 'https://github.com/acme/site', defaultBranch: 'trunk' },
    latestCommit: { sha: 'abc123', message: 'Release', author: 'Ana' },
    pullRequests: [{ number: 12, title: 'Feature' }, null, 'invalid'],
    deployment: { environment: 'production', state: 'success' },
    syncedAt: '2026-10-02T12:00:00.000Z',
  }), {
    repository: { fullName: 'acme/site', url: 'https://github.com/acme/site', defaultBranch: 'trunk' },
    latestCommit: { sha: 'abc123', message: 'Release', author: 'Ana' },
    pullRequests: [{ number: 12, title: 'Feature' }],
    deployment: { environment: 'production', state: 'success', url: '' },
    syncedAt: '2026-10-02T12:00:00.000Z',
  });
});

test('fills missing arrays and objects with safe empty values', () => {
  assert.deepEqual(normalizeRepositoryActivity({ repository: null, pullRequests: null, syncedAt: 'invalid' }), {
    repository: { fullName: '', url: '', defaultBranch: '' },
    latestCommit: null,
    pullRequests: [],
    deployment: null,
    syncedAt: null,
  });
});

test('handles a missing or non-object activity payload', () => {
  assert.deepEqual(normalizeRepositoryActivity(undefined), {
    repository: { fullName: '', url: '', defaultBranch: '' },
    latestCommit: null,
    pullRequests: [],
    deployment: null,
    syncedAt: null,
  });
});
