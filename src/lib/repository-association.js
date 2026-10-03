export function repositoryAssociationDraft(repository = {}) {
  return {
    projectId: String(repository.projectId || ''),
    clientId: String(repository.clientId || ''),
    project: String(repository.project || ''),
    clientName: String(repository.clientName || ''),
  };
}

export function repositoryAssociationIssue({ draft = {}, scopeMode = 'all', projects = [], clients = [], projectsLoading = false, clientsLoading = false, projectsError = '', clientsError = '' } = {}) {
  const projectId = String(draft.projectId || '');
  const clientId = String(draft.clientId || '');
  if (projectId && clientId) return 'Vincule o repositório a um projeto ou a um cliente, não aos dois.';
  if (projectId && projectsLoading) return 'Aguarde o carregamento dos projetos antes de salvar.';
  if (clientId && clientsLoading) return 'Aguarde o carregamento dos clientes antes de salvar.';
  if (projectId && projectsError) return 'Não foi possível validar o projeto. Atualize a lista e tente novamente.';
  if (clientId && clientsError) return 'Não foi possível validar o cliente. Atualize a lista e tente novamente.';
  if (projectId && !projects.some((project) => String(project.id) === projectId)) return 'Selecione um projeto disponível neste workspace.';
  if (clientId && !clients.some((client) => String(client.id) === clientId)) return 'Selecione um cliente disponível neste workspace.';
  if (scopeMode === 'selected' && !projectId && !clientId) {
    if ((projectsLoading || clientsLoading)) return 'Aguarde o carregamento dos vínculos permitidos antes de salvar.';
    if (projectsError && clientsError) return 'Atualize os projetos e clientes antes de vincular este repositório ao seu escopo.';
    return 'Vincule este repositório a um dos projetos ou clientes do seu escopo.';
  }
  return '';
}

export function buildRepositoryAssociationPayload(draft, { projects = [], clients = [] } = {}) {
  const projectId = String(draft.projectId || '');
  const clientId = String(draft.clientId || '');
  if (projectId) {
    const project = projects.find((item) => String(item.id) === projectId);
    return { projectId, clientId: '', clientName: '', project: String(project?.name || project?.title || draft.project || '').trim() };
  }
  if (clientId) {
    const client = clients.find((item) => String(item.id) === clientId);
    return { projectId: '', clientId, clientName: String(client?.name || draft.clientName || '').trim(), project: String(draft.project || '').trim() };
  }
  return { projectId: '', clientId: '', clientName: '', project: String(draft.project || '').trim() };
}
