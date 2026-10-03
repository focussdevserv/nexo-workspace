import type { WorkspacePermissions } from './authorization.js';

type WorkspaceUserClaims = {
  sub: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  permissions?: WorkspacePermissions | null;
  [claim: string]: unknown;
};

/** Attach the current database permissions to the authenticated request context. */
export function authenticatedWorkspaceUserWithCurrentPermissions<T extends WorkspaceUserClaims>(
  claims: T,
  databasePermissions: WorkspacePermissions | null | undefined,
): T & { permissions: WorkspacePermissions | null } {
  return { ...claims, permissions: databasePermissions ?? null };
}
