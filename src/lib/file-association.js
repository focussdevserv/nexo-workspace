import { findProjectClient } from './project-client-link.js';

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function uniqueMatch(records, predicate) {
  const matches = records.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

export function fileAssociationDraft(file = {}, clients = [], projects = []) {
  // Workspace records have used all three client ID fields over time. Prefer
  // the canonical ID fields and only fall back to a name for genuinely legacy
  // records; otherwise opening/saving an older Drive entry can silently unlink
  // it from its client.
  const clientIds = [file.workspaceClientId, file.clientId, file.clientRecordId]
    .filter((value) => value != null && String(value).trim())
    .map(String);
  const client = clientIds.length
    ? uniqueMatch(clients, (item) => clientIds.every((id) => id === String(item.id)))
    : uniqueMatch(clients, (item) => normalizeName(item.name || item.title) === normalizeName(file.client));
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

export function buildLinkedDriveFileRecord({ file, id, scopeLink = {}, clients = [], projects = [], date = '', size = '', type = '' }) {
  if (!file?.id || !id) return { error: 'drive_file_or_record_id_missing' };
  const association = resolveFileAssociation(scopeLink, clients, projects);
  if (association.error) return association;

  return {
    id,
    name: String(file.name || 'Arquivo sem nome'),
    project: association.project,
    client: association.client,
    date,
    size,
    type,
    folder: file.mimeType === 'application/vnd.google-apps.folder',
    url: file.url || '',
    driveFileId: String(file.id),
    mimeType: file.mimeType || '',
    ...association,
  };
}
