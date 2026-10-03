export type WahaIncomingMessage = {
  messageId: string;
  sessionId: string;
  chatId: string;
  from: string;
  text: string;
  timestamp: string;
  time: string;
  displayName: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string | null;
  mediaFilename?: string;
};

/** Add an inbound message to the latest conversation snapshot. The route calls
 * this only after acquiring the per-chat advisory lock and row lock in a tx. */
export function appendWahaIncomingMessage(current: Record<string, any> | null, input: WahaIncomingMessage) {
  const previous = current || {};
  const history = Array.isArray(previous.history) ? previous.history as Array<Record<string, any>> : [];
  if (history.some((item) => item.providerMessageId === input.messageId)) return null;

  const entry = {
    id: input.messageId,
    providerMessageId: input.messageId,
    side: 'received',
    text: input.text || 'Mensagem recebida',
    time: input.time,
    timestamp: input.timestamp,
    status: 'received',
    ...(input.mediaFilename ? { attachment: input.mediaFilename } : {}),
  };
  return {
    ...previous,
    name: previous.name || input.displayName,
    company: input.clientName || previous.company || '',
    clientId: input.clientId || previous.clientId || '',
    phone: input.from,
    email: input.clientEmail || previous.email || '',
    initials: input.displayName.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase(),
    color: previous.color || 'blue',
    channel: 'WhatsApp',
    status: 'open',
    whatsappSessionId: input.sessionId,
    whatsappChatId: input.chatId,
    text: input.text || 'Mensagem recebida',
    time: input.timestamp,
    unread: Number(previous.unread || 0) + 1,
    history: [...history, entry],
  };
}

export function applyWahaMessageAck(current: Record<string, any>, messageId: string, ack: number) {
  const history = Array.isArray(current.history) ? current.history as Array<Record<string, any>> : [];
  let found = false;
  const nextHistory = history.map((item) => {
    if (item.providerMessageId !== messageId) return item;
    found = true;
    return { ...item, ack, status: ack >= 3 ? 'read' : ack >= 2 ? 'delivered' : item.status };
  });
  return found ? { ...current, history: nextHistory } : null;
}
