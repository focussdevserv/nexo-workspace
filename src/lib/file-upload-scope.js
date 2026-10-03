import { findProjectClient } from './project-client-link.js';

export function resolveFileUploadScopeLink(scope, selection, projects = [], clients = []) {
  if (scope?.mode !== 'selected') return {};
  const value = String(selection || '');
  if (value.startsWith('client:')) {
    const clientId = value.slice('client:'.length);
    return scope.clientIds?.map(String).includes(clientId) ? { clientId } : null;
  }
  if (value.startsWith('project:')) {
    const projectId = value.slice('project:'.length);
    if (!scope.projectIds?.map(String).includes(projectId)) return null;
    const project = projects.find((item) => String(item.id) === projectId);
    const linkedClient = findProjectClient(project, clients);
    const clientId = linkedClient?.id || project?.clientId || project?.workspaceClientId || project?.clientRecordId || '';
    return { projectId, ...(clientId ? { clientId: String(clientId) } : {}) };
  }
  return null;
}
