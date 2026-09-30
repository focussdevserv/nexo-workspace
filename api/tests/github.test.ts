import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGitHubRepositoryActivity } from '../src/integrations/github.js';

test('maps real repository, latest commit, pull requests, and deployment status', () => {
  const result = mapGitHubRepositoryActivity({
    repository: { name: 'nexo', full_name: 'focussdev/nexo', html_url: 'https://github.com/focussdev/nexo', default_branch: 'main', private: true },
    commits: [{ sha: 'abcdef123456', html_url: 'https://github.com/focussdev/nexo/commit/abcdef', commit: { message: 'Ship dashboard\nMore detail', author: { name: 'Focuss', date: '2026-09-30T12:00:00Z' } } }],
    pullRequests: [{ number: 4, title: 'Improve agenda', html_url: 'https://github.com/focussdev/nexo/pull/4', user: { login: 'focuss' } }],
    deployments: [{ id: 22, environment: 'production', ref: 'main', created_at: '2026-09-30T11:00:00Z' }],
    deploymentStatuses: [{ state: 'success', environment_url: 'https://focussdev.space', created_at: '2026-09-30T11:03:00Z' }],
  });
  assert.equal(result.repository.fullName, 'focussdev/nexo');
  assert.equal(result.latestCommit?.sha, 'abcdef1');
  assert.equal(result.latestCommit?.message, 'Ship dashboard');
  assert.equal(result.pullRequests[0]?.number, 4);
  assert.equal(result.deployment?.state, 'success');
  assert.equal(result.deployment?.url, 'https://focussdev.space');
});

test('handles a repository that has no commit, pull request, or deployment data', () => {
  const result = mapGitHubRepositoryActivity({ repository: { name: 'empty' }, commits: [], pullRequests: [], deployments: [], deploymentStatuses: [] });
  assert.equal(result.latestCommit, null);
  assert.deepEqual(result.pullRequests, []);
  assert.equal(result.deployment, null);
});
