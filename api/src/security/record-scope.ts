import type { WorkspaceRecordScope } from './authorization.js';

export const clientLinkedWorkspaceResources = [
  'leads', 'companies', 'contacts', 'proposals', 'contracts', 'tasks', 'approvals', 'files', 'hours',
  'tickets', 'inbox', 'site-assets', 'monitors', 'repositories', 'revenues', 'expenses', 'finance-transactions',
];
const clientLinkedResources = new Set<string>(clientLinkedWorkspaceResources);
type WorkspaceProjectLink = { id: string; data: Record<string, unknown> };
const projectClientLinksByScope = new WeakMap<object, Map<string, string>>();
// Keep these aliases aligned with workspaceRecordScopeWhere in server.ts.
// Records are schemaless JSON, so older/imported rows may use snake_case or
// company/customer terminology for the same tenant relationship.
export const workspaceClientReferenceFields = [
  'clientId', 'workspaceClientId', 'clientRecordId', 'client_id', 'workspace_client_id', 'client_record_id',
  'companyId', 'workspaceCompanyId', 'companyRecordId', 'company_id', 'workspace_company_id', 'company_record_id',
  'customerId', 'workspaceCustomerId', 'customerRecordId', 'customer_id', 'workspace_customer_id', 'customer_record_id',
] as const;
export const workspaceProjectReferenceFields = [
  'projectId', 'sourceProjectId', 'workspaceProjectId', 'projectRecordId',
  'project_id', 'source_project_id', 'workspace_project_id', 'project_record_id',
] as const;

/** Keep only unambiguous, string-valued project → client links for selected projects. */
export function selectedWorkspaceProjectClientLinks(scope: WorkspaceRecordScope | null | undefined, projects: WorkspaceProjectLink[]) {
  const assignedProjects = new Set((scope?.projectIds || []).map(String));
  const links = new Map<string, string>();
  for (const project of projects) {
    const id = String(project.id);
    if (!assignedProjects.has(id)) continue;
    const raw = workspaceClientReferenceFields.map((field) => project.data[field]).filter((value) => value !== undefined && value !== null && value !== '');
    if (raw.length === 0 || raw.some((value) => typeof value !== 'string')) continue;
    const values = new Set(raw as string[]);
    if (values.size === 1) links.set(id, raw[0] as string);
  }
  return links;
}

/** Cache canonical links on the request's permission scope without serializing them back to the browser or database. */
export function rememberWorkspaceProjectClientLinks(scope: WorkspaceRecordScope | null | undefined, projects: WorkspaceProjectLink[]) {
  if (!scope || scope.mode !== 'selected') return;
  projectClientLinksByScope.set(scope, selectedWorkspaceProjectClientLinks(scope, projects));
}

export function workspaceProjectClientLinksForScope(scope?: WorkspaceRecordScope | null) {
  return scope && typeof scope === 'object' ? projectClientLinksByScope.get(scope) || new Map<string, string>() : new Map<string, string>();
}

export function billingClientIdsForWorkspaceScope(scope?: WorkspaceRecordScope | null, projects: Array<{ id: string; data: Record<string, unknown> }> = []) {
  if (!scope || scope.mode !== 'selected') return null;
  const clientIds = new Set(scope.clientIds.map(String));
  for (const clientId of selectedWorkspaceProjectClientLinks(scope, projects).values()) clientIds.add(clientId);
  return [...clientIds];
}

export function recordMatchesWorkspaceScope(resource: string, recordId: string, data: Record<string, unknown>, scope?: WorkspaceRecordScope | null) {
  if (!scope || scope.mode === 'all') return true;
  const clients = new Set(scope.clientIds.map(String));
  const projects = new Set(scope.projectIds.map(String));
  if (resource === 'clients') return clients.has(String(recordId));
  if (resource !== 'projects' && !clientLinkedResources.has(resource)) return true;
  const referencesFor = (fields: readonly string[]) => fields
    .map((field) => data[field])
    .filter((value) => value !== undefined && value !== null && value !== '');
  const clientReferences = referencesFor(workspaceClientReferenceFields);
  const projectReferences = referencesFor(workspaceProjectReferenceFields);
  // Conflicting legacy aliases or a selected project paired with another
  // client's id must not widen a record's visibility. Reject malformed JSON
  // values too: PostgreSQL ->> coerces non-string JSON to text, so silently
  // ignoring them here would disagree with the scoped list predicate.
  if (clientReferences.some((id) => typeof id !== 'string')
    || projectReferences.some((id) => typeof id !== 'string' || !projects.has(id))) return false;
  const scopedClientReferences = clientReferences.filter((id): id is string => typeof id === 'string');
  const scopedProjectReferences = projectReferences.filter((id): id is string => typeof id === 'string');
  const projectClientLinks = workspaceProjectClientLinksForScope(scope);
  const projectReferencesForRecord = resource === 'projects' && projects.has(String(recordId))
    ? [...scopedProjectReferences, String(recordId)]
    : scopedProjectReferences;
  if (new Set(scopedProjectReferences).size > 1 || new Set(scopedClientReferences).size > 1) return false;
  const isAllowedClientReference = (clientId: string) => clients.has(clientId)
    || projectReferencesForRecord.some((projectId) => projectClientLinks.get(projectId) === clientId);
  if (scopedClientReferences.some((id) => !isAllowedClientReference(id))) return false;
  if (resource === 'projects') return projects.has(String(recordId)) || scopedClientReferences.some((id) => clients.has(id));
  return scopedClientReferences.some((id) => clients.has(id)) || scopedProjectReferences.some((id) => projects.has(id));
}
