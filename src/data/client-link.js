export function belongsToClient(record, client, legacyValue) {
  if (!record || !client) return false;
  if (record.clientId != null && String(record.clientId).trim()) {
    return String(record.clientId) === String(client.id);
  }
  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
  const clientName = normalize(client.name);
  const recordName = normalize(legacyValue ?? record.clientName ?? record.client ?? record.company);
  return Boolean(clientName && recordName) && recordName === clientName;
}
