import { belongsToClient } from '../data/client-link.js';

export function safeClientFileHref(file) {
  if (!file || file.localOnly) return '';
  const raw = String(file.url || '').trim();
  if (raw) {
    try {
      const url = new URL(raw);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.toString();
    } catch { /* A Drive id below can still provide a safe canonical URL. */ }
  }
  return file.driveFileId ? `https://drive.google.com/open?id=${encodeURIComponent(String(file.driveFileId))}` : '';
}

export function clientFileMetadataPatch(file, { name, projectId = '', projects = [], client } = {}) {
  const nextName = String(name || '').trim();
  if (!file?.id || !client?.id || !nextName) throw new Error('client_file_metadata_invalid');
  const project = projectId ? projects.find((item) => String(item.id) === String(projectId)) : null;
  if (projectId && (!project || !belongsToClient(project, client, project.client))) throw new Error('client_file_project_invalid');
  return {
    name: nextName,
    clientId: String(client.id),
    client: String(client.name || ''),
    projectId: project ? String(project.id) : '',
    project: project ? String(project.name || project.title || '') : '',
  };
}

export function clientFileDeleteConfirmation(file) {
  return `Remover "${String(file?.name || 'arquivo')}" da ficha deste cliente? O registro ser\u00e1 removido, mas o arquivo original no Google Drive ser\u00e1 preservado.`;
}
