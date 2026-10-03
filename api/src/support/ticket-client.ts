const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ticketClientIdFromDraft(data: Record<string, unknown>) {
  const value = data.clientId;
  return typeof value === 'string' && uuidPattern.test(value) ? value : null;
}

export function canonicalTicketClientData(data: Record<string, unknown>, client: { id: string; data: Record<string, unknown> }) {
  const clientName = String(client.data.name ?? client.data.title ?? '').trim();
  return { ...data, clientId: client.id, client: clientName };
}
