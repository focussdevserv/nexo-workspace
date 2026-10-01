import type { WorkspaceRecordScope } from './authorization.js';

export const clientLinkedWorkspaceResources = [
  'leads', 'companies', 'contacts', 'proposals', 'contracts', 'tasks', 'approvals', 'files', 'hours',
  'tickets', 'inbox', 'site-assets', 'monitors', 'repositories', 'revenues', 'expenses', 'finance-transactions',
];
const clientLinkedResources = new Set<string>(clientLinkedWorkspaceResources);

export function billingClientIdsForWorkspaceScope(scope?: WorkspaceRecordScope | null, projects: Array<{ id: string; data: Record<string, unknown> }> = []) {
  if (!scope || scope.mode !== 'selected') return null;
  const clientIds = new Set(scope.clientIds.map(String));
  const assignedProjects = new Set(scope.projectIds.map(String));
  for (const project of projects) {
    if (!assignedProjects.has(String(project.id))) continue;
    const clientId = project.data.clientId ?? project.data.workspaceClientId ?? project.data.clientRecordId;
    if (typeof clientId === 'string' && clientId) clientIds.add(clientId);
  }
  return [...clientIds];
}

export function recordMatchesWorkspaceScope(resource: string, recordId: string, data: Record<string, unknown>, scope?: WorkspaceRecordScope | null) {
  if (!scope || scope.mode === 'all') return true;
  const clients = new Set(scope.clientIds.map(String));
  const projects = new Set(scope.projectIds.map(String));
  if (resource === 'clients') return clients.has(String(recordId));
  if (resource === 'projects') return projects.has(String(recordId)) || clients.has(String(data.clientId || data.workspaceClientId || ''));
  if (!clientLinkedResources.has(resource)) return true;
  const linkedClientId = String(data.clientId || data.workspaceClientId || data.clientRecordId || '');
  const linkedProjectId = String(data.projectId || data.sourceProjectId || '');
  return Boolean((linkedClientId && clients.has(linkedClientId)) || (linkedProjectId && projects.has(linkedProjectId)));
}
