import { findProjectClient } from './project-client-link.js';

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function uniqueMatch(records, predicate) {
  const matches = records.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

export function fileAssociationDraft(file = {}, clients = [], projects = []) {
  const client = uniqueMatch(clients, (item) => String(item.id) === String(file.clientId || ''))
    || uniqueMatch(clients, (item) => normalizeName(item.name || item.title) === normalizeName(file.client));
  const project = uniqueMatch(projects, (item) => String(item.id) === String(file.projectId || ''))
    || uniqueMatch(projects, (item) => normalizeName(item.name || item.title) === normalizeName(file.project));
  const projectClient = project && findProjectClient(project, clients);
  const resolvedClient = client && projectClient && String(client.id) !== String(projectClient.id) ? projectClient : client || projectClient;
  return { clientId: String(resolvedClient?.id || ''), projectId: String(project?.id || '') };
}

export function resolveFileAssociation(draft = {}, clients = [], projects = []) {
  const client = draft.clientId ? clients.find((item) => String(item.id) === String(draft.clientId)) : null;
  if (draft.clientId && !client) return { error: 'file_client_not_found' };

  const project = draft.projectId ? projects.find((item) => String(item.id) === String(draft.projectId)) : null;
  if (draft.projectId && !project) return { error: 'file_project_not_found' };

  const projectClient = project && findProjectClient(project, clients);
  if (client && projectClient && String(client.id) !== String(projectClient.id)) return { error: 'file_project_client_mismatch' };
  const resolvedClient = client || projectClient;
  return {
    clientId: String(resolvedClient?.id || ''),
    client: String(resolvedClient?.name || resolvedClient?.title || draft.client || ''),
    projectId: String(project?.id || ''),
    project: String(project?.name || project?.title || draft.project || ''),
  };
}
