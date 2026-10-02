export function resolveFileUploadScopeLink(scope, selection, projects = []) {
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
    const clientId = project?.clientId || project?.workspaceClientId || project?.clientRecordId || '';
    return { projectId, ...(clientId ? { clientId: String(clientId) } : {}) };
  }
  return null;
}
