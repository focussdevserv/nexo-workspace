export function filterRecordsForClient(records, client) {
  if (!Array.isArray(records) || !client) return Array.isArray(records) ? records : [];
  const clientId = String(client.clientId || '').trim();
  if (clientId) {
    const linked = records.filter((record) => String(record.workspaceClientId || record.clientId || '') === clientId);
    const hasExplicitLinks = records.some((record) => Boolean(record.workspaceClientId || record.clientId));
    if (linked.length || hasExplicitLinks) return linked;
  }
  const name = String(client.clientName || '').trim().toLocaleLowerCase('pt-BR');
  return name ? records.filter((record) => String(record.clientName || record.client || '').trim().toLocaleLowerCase('pt-BR') === name) : records;
}
