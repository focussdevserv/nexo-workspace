import assert from 'node:assert/strict';
import test from 'node:test';
import { githubRepositoryRegistrationAccess } from '../src/integrations/github-repository-access.js';

const scope = { mode: 'selected' as const, clientIds: ['client-1'], projectIds: ['project-1'] };

test('permits GitHub activity only for one active repository registered in the requesting organization', () => {
  const records = [
    { id: 'repo-org-a', organizationId: 'org-a', data: { owner: 'Acme', name: 'site' } },
    { id: 'repo-org-b', organizationId: 'org-b', data: { owner: 'Acme', name: 'site' } },
    { id: 'repo-archived', organizationId: 'org-a', archivedAt: new Date(), data: { owner: 'Acme', name: 'old-site' } },
  ];

  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-a', ' acme ', 'SITE'), {
    allowed: true, repositoryId: 'repo-org-a',
  });
  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-b', 'acme', 'site'), {
    allowed: true, repositoryId: 'repo-org-b',
  });
  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'private-unregistered'), {
    allowed: false, reason: 'not_registered',
  });
  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'site', scope), {
    allowed: false, reason: 'outside_scope',
  });
});

test('allows scoped repository activity only when the saved client or project link is in scope', () => {
  const records = [
    { id: 'repo-project', organizationId: 'org-a', data: { owner: 'Acme', name: 'project-repo', projectId: 'project-1' } },
    { id: 'repo-client', organizationId: 'org-a', data: { owner: 'Acme', name: 'client-repo', clientId: 'client-1' } },
    { id: 'repo-other', organizationId: 'org-a', data: { owner: 'Acme', name: 'other-repo', projectId: 'project-2' } },
  ];

  assert.equal(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'project-repo', scope).allowed, true);
  assert.equal(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'client-repo', scope).allowed, true);
  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'other-repo', scope), {
    allowed: false, reason: 'outside_scope',
  });
});

test('rejects duplicate active repository registrations rather than choosing one scope arbitrarily', () => {
  const records = [
    { id: 'repo-1', organizationId: 'org-a', data: { owner: 'Acme', name: 'site', projectId: 'project-1' } },
    { id: 'repo-2', organizationId: 'org-a', data: { owner: ' acme ', name: 'SITE', projectId: 'project-2' } },
  ];
  assert.deepEqual(githubRepositoryRegistrationAccess(records, 'org-a', 'acme', 'site', scope), {
    allowed: false, reason: 'ambiguous_registration',
  });
});
