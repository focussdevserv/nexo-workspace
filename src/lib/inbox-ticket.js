export function canCreateInboxTicket(user, localDemo = false) {
  if (localDemo || user?.role === 'owner') return true;
  const support = user?.permissions?.support;
  return (user?.role === 'admin' && !support) || (support?.read === true && support?.write === true);
}

export function findInboxSourceTicket(tickets, conversation, channel) {
  if (!conversation) return null;
  const source = channel === 'E-mail'
    ? String(conversation.threadId || conversation.id || '')
    : String(conversation.id || '');
  if (!source) return null;
  return (Array.isArray(tickets) ? tickets : []).find((ticket) => {
    const ticketChannel = String(ticket.sourceChannel || '').toLowerCase();
    const channelMatches = channel === 'E-mail'
      ? ticketChannel === 'e-mail' || ticketChannel === 'hostinger'
      : ticketChannel === 'whatsapp';
    if (!channelMatches) return false;
    return channel === 'E-mail'
      ? String(ticket.sourceThreadId || ticket.sourceConversationId || '') === source
      : String(ticket.sourceConversationId || '') === source;
  }) || null;
}

export function buildInboxTicket(conversation, { channel, client, assignee, author, now = new Date(), slaHours = 24 } = {}) {
  if (!conversation || !client?.id || !String(client.name || '').trim()) return null;
  const source = channel === 'E-mail' ? (conversation.provider === 'hostinger' ? 'Hostinger' : 'E-mail') : 'WhatsApp';
  const title = String(conversation.subject || conversation.text || `Atendimento de ${conversation.name || client.name}`).trim().replace(/\s+/g, ' ').slice(0, 180);
  const detail = [
    `Origem: ${source}`,
    `Contato: ${String(conversation.name || client.name).trim()}`,
    conversation.email ? `E-mail: ${String(conversation.email).trim()}` : '',
    conversation.phone ? `Telefone: ${String(conversation.phone).trim()}` : '',
    conversation.text ? `Mensagem: ${String(conversation.text).trim()}` : '',
    channel === 'E-mail' && (conversation.threadId || conversation.id) ? `Thread: ${String(conversation.threadId || conversation.id)}` : '',
  ].filter(Boolean).join('\n').slice(0, 5000);
  const createdAt = now.toISOString();
  const hours = [4, 8, 24, 48].includes(Number(slaHours)) ? Number(slaHours) : 24;
  return {
    code: `NX-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title: title || `Atendimento de ${client.name}`,
    client: client.name,
    clientId: client.id,
    priority: 'Media',
    status: 'Aberto',
    updatedAt: createdAt,
    slaHours: hours,
    slaDueAt: new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString(),
    detail,
    owner: assignee?.name || '',
    ownerId: assignee?.id || '',
    activity: [{ id: globalThis.crypto.randomUUID(), type: 'created', message: `Ticket criado a partir da conversa ${source}`, author: author || 'Equipe', at: createdAt }],
    sourceChannel: source,
    sourceConversationId: String(conversation.id || ''),
    sourceThreadId: channel === 'E-mail' ? String(conversation.threadId || conversation.id || '') : '',
  };
}
