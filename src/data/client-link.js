export function belongsToClient(record, client, legacyValue) {
  if (!record || !client) return false;
  if (record.workspaceClientId != null && String(record.workspaceClientId).trim()) {
    return String(record.workspaceClientId) === String(client.id);
  }
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

export function clientTicketPresentation(ticket) {
  const status = String(ticket?.status || 'Aberto');
  const normalizedStatus = status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const isResolved = ['resolvido', 'resolvida', 'closed', 'done'].includes(normalizedStatus);
  return {
    id: ticket?.id || ticket?.code || ticket?.title || 'ticket',
    code: ticket?.code || 'Ticket',
    title: ticket?.title || 'Solicitacao sem titulo',
    status,
    updatedAt: ticket?.updatedAt || ticket?.createdAt || '',
    tone: isResolved ? 'green' : 'amber',
  };
}
