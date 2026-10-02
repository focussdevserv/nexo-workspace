import { classifyWorkspaceFile } from './file-category.js';

export function clientFileRecordForUpload(client, file, { project = null, localOnly = false, createdAt = new Date().toISOString() } = {}) {
  if (!client?.id || !file?.id || !String(file.name || '').trim()) throw new Error('client_file_link_invalid');
  const bytes = Number(file.size) || 0;
  return {
    name: String(file.name).trim(),
    client: String(client.name || client.title || ''),
    clientId: String(client.id),
    project: String(project?.name || project?.title || ''),
    ...(project?.id ? { projectId: String(project.id) } : {}),
    date: createdAt,
    size: `${(bytes / 1024 / 1024).toFixed(2)} MB`,
    type: classifyWorkspaceFile({ name: file.name, mimeType: file.mimeType || file.type }),
    folder: false,
    url: String(file.url || ''),
    driveFileId: localOnly ? undefined : String(file.id),
    mimeType: String(file.mimeType || file.type || 'application/octet-stream'),
    localOnly,
  };
}
