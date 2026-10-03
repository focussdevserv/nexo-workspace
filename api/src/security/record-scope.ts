import type { WorkspaceRecordScope } from './authorization.js';

export const clientLinkedWorkspaceResources = [
  'leads', 'companies', 'contacts', 'proposals', 'contracts', 'tasks', 'approvals', 'files', 'hours',
  'tickets', 'inbox', 'site-assets', 'monitors', 'repositories', 'revenues', 'expenses', 'finance-transactions',
];
const clientLinkedResources = new Set<string>(clientLinkedWorkspaceResources);
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

export function billingClientIdsForWorkspaceScope(scope?: WorkspaceRecordScope | null, projects: Array<{ id: string; data: Record<string, unknown> }> = []) {
  if (!scope || scope.mode !== 'selected') return null;
  const clientIds = new Set(scope.clientIds.map(String));
  const assignedProjects = new Set(scope.projectIds.map(String));
  for (const project of projects) {
    if (!assignedProjects.has(String(project.id))) continue;
    for (const field of workspaceClientReferenceFields) {
      const clientId = project.data[field];
      if (typeof clientId === 'string' && clientId) clientIds.add(clientId);
    }
  }
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
  if (clientReferences.some((id) => typeof id !== 'string' || !clients.has(id))
    || projectReferences.some((id) => typeof id !== 'string' || !projects.has(id))) return false;
  const scopedClientReferences = clientReferences.filter((id): id is string => typeof id === 'string');
  const scopedProjectReferences = projectReferences.filter((id): id is string => typeof id === 'string');
  if (resource === 'projects') return projects.has(String(recordId)) || scopedClientReferences.some((id) => clients.has(id));
  return scopedClientReferences.some((id) => clients.has(id)) || scopedProjectReferences.some((id) => projects.has(id));
}
