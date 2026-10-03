export function filterRecordsForClient(records, client) {
  if (!Array.isArray(records) || !client) return Array.isArray(records) ? records : [];
  const clientId = String(client.clientId || '').trim();
  if (clientId) {
    const referencesFor = (record) => [record?.workspaceClientId, record?.clientId, record?.clientRecordId]
      .filter((value) => value != null && String(value).trim())
      .map((value) => String(value).trim());
    const linked = records.filter((record) => {
      const references = referencesFor(record);
      return references.length > 0 && references.every((id) => id === clientId);
    });
    const hasExplicitLinks = records.some((record) => referencesFor(record).length > 0);
    if (linked.length || hasExplicitLinks) return linked;
  }
  const name = String(client.clientName || '').trim().toLocaleLowerCase('pt-BR');
  return name ? records.filter((record) => String(record.clientName || record.client || '').trim().toLocaleLowerCase('pt-BR') === name) : records;
}
