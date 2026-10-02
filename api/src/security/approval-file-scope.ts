type RecordData = Record<string, unknown>;

function normalized(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function approvalFileMatchesClientScope(input: {
  fileId: string;
  file: RecordData;
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  project?: RecordData;
}) {
  if (String(input.file.driveFileId || '') !== input.fileId) return false;
  const fileClientId = String(input.file.clientId || input.file.workspaceClientId || input.file.clientRecordId || '');
  const fileClient = normalized(input.file.client);
  const clientName = normalized(input.clientName);
  const directClientMatch = fileClientId === input.clientId || Boolean(fileClient && fileClient !== 'sem cliente' && clientName && fileClient === clientName);
  if (fileClientId && fileClientId !== input.clientId) return false;
  if (fileClient && fileClient !== 'sem cliente' && clientName && fileClient !== clientName) return false;

  const fileProjectId = String(input.file.projectId || input.file.sourceProjectId || '');
  const fileProject = normalized(input.file.project);
  const hasProjectLink = Boolean(fileProjectId || (fileProject && fileProject !== 'sem projeto'));
  const targetProjectMatches = Boolean(input.projectId && input.project && (
    (fileProjectId && fileProjectId === input.projectId)
    || (!fileProjectId && fileProject && fileProject === normalized(input.projectName))
  ));
  const projectClientId = String(input.project?.clientId || input.project?.workspaceClientId || input.project?.clientRecordId || '');
  const projectClientName = normalized(input.project?.client);
  const projectBelongsToClient = Boolean(input.project && (
    projectClientId === input.clientId
    || (!projectClientId && projectClientName && projectClientName === clientName)
  ));

  // A selected project is part of the approval scope even when the file is
  // linked directly to its client. Never let a valid client file legitimize
  // a project that belongs to a different client (or has no client link).
  if (input.projectId && !projectBelongsToClient) return false;

  if (hasProjectLink) return targetProjectMatches && projectBelongsToClient;
  return directClientMatch;
}
