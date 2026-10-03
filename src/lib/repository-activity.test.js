import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRepositoryActivity, repositoryActivityIdentityChanged, safeRepositoryExternalUrl } from './repository-activity.js';

test('invalidates cached activity only when an edit changes repository identity', () => {
  const original = { owner: 'Acme', name: 'site', project: 'Old project', branch: 'main' };
  assert.equal(repositoryActivityIdentityChanged(original, { ...original, project: 'New project' }), false);
  assert.equal(repositoryActivityIdentityChanged(original, { ...original, owner: ' acme ' }), false);
  assert.equal(repositoryActivityIdentityChanged(original, { ...original, name: 'new-site' }), true);
  assert.equal(repositoryActivityIdentityChanged(original, { ...original, owner: 'other-org' }), true);
});

test('repository and deployment links accept credential-free HTTPS URLs only', () => {
  assert.equal(safeRepositoryExternalUrl('https://github.com/acme/site'), 'https://github.com/acme/site');
  assert.equal(safeRepositoryExternalUrl('https://preview.example.test/build/42'), 'https://preview.example.test/build/42');
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', 'http://example.test', '//attacker.example', 'https://user:pass@example.test', '/relative/path', 'https://example.test\\\\attacker']) {
    assert.equal(safeRepositoryExternalUrl(value), '', value);
  }
});

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

test('drops unsafe repository or deployment URLs from normalized activity', () => {
  const result = normalizeRepositoryActivity({
    repository: { url: 'javascript:alert(1)' },
    deployment: { url: 'data:text/html,unsafe', state: 'success' },
  });
  assert.equal(result.repository.url, '');
  assert.equal(result.deployment.url, '');
});
