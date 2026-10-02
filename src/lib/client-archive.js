export function archiveClientRecord(client, archivedAt = new Date().toISOString()) {
  if (!client || typeof client !== 'object') return client;
  return { ...client, status: 'Inativo', archivedAt };
}

export function restoreClientRecord(client) {
  if (!client || typeof client !== 'object') return client;
  const { archivedAt: _archivedAt, ...record } = client;
  return { ...record, status: 'Ativo' };
}

export function isArchivedClient(client) {
  return Boolean(client?.archivedAt);
}
