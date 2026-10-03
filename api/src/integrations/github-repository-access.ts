import { recordMatchesWorkspaceScope } from '../security/record-scope.js';
import type { WorkspaceRecordScope } from '../security/authorization.js';

type RegisteredRepository = {
  id: string;
  organizationId: string;
  data: Record<string, unknown>;
  archivedAt?: unknown;
};

export type GithubRepositoryAccessResult =
  | { allowed: true; repositoryId: string }
  | { allowed: false; reason: 'not_registered' | 'ambiguous_registration' | 'outside_scope' };

/** Restrict GitHub activity lookups to one active repository registered in this organization and scope. */
export function githubRepositoryRegistrationAccess(
  rows: RegisteredRepository[],
  organizationId: string,
  owner: string,
  name: string,
  scope?: WorkspaceRecordScope | null,
): GithubRepositoryAccessResult {
  const canonical = (value: unknown) => String(value || '').trim().toLocaleLowerCase('en-US');
  const matches = rows.filter((row) => row.organizationId === organizationId
    && !row.archivedAt
    && canonical(row.data.owner) === canonical(owner)
    && canonical(row.data.name) === canonical(name));
  if (matches.length === 0) return { allowed: false, reason: 'not_registered' };
  if (matches.length > 1) return { allowed: false, reason: 'ambiguous_registration' };
  const repository = matches[0];
  if (!repository) return { allowed: false, reason: 'not_registered' };
  if (!recordMatchesWorkspaceScope('repositories', repository.id, repository.data, scope)) {
    return { allowed: false, reason: 'outside_scope' };
  }
  return { allowed: true, repositoryId: repository.id };
}
