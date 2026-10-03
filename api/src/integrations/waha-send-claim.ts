export type WahaPendingMessage = Record<string, unknown> & {
  clientMessageId: string;
  status: 'sending';
  time: string;
};

export type WahaSendClaim =
  | { kind: 'already_sent'; messageId: string }
  | { kind: 'already_sending'; messageId: string }
  | { kind: 'claimed'; data: Record<string, unknown>; pending: WahaPendingMessage };

/** Decide whether a message ID may be sent while the caller holds the conversation row lock. */
export function claimWahaMessage(
  current: Record<string, unknown>,
  input: { sessionId: string; chatId: string; clientMessageId: string; text: string; attachment?: { filename: string } },
  now = new Date(),
): WahaSendClaim {
  const history = Array.isArray(current.history) ? current.history as Array<Record<string, unknown>> : [];
  const duplicate = history.find((message) => message.clientMessageId === input.clientMessageId);
  if (duplicate?.status === 'sent' && duplicate.providerMessageId) {
    return { kind: 'already_sent', messageId: String(duplicate.providerMessageId) };
  }
  const pendingAge = now.getTime() - Date.parse(String(duplicate?.createdAt || ''));
  if (duplicate?.status === 'sending' && pendingAge >= 0 && pendingAge < 30_000) {
    return { kind: 'already_sending', messageId: String(duplicate.clientMessageId) };
  }
  const pending: WahaPendingMessage = {
    id: input.clientMessageId,
    clientMessageId: input.clientMessageId,
    side: 'sent',
    text: input.text,
    ...(input.attachment ? { attachment: input.attachment.filename } : {}),
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: now.toISOString(),
    status: 'sending',
  };
  const pendingHistory = duplicate
    ? history.map((message) => message.clientMessageId === input.clientMessageId ? pending : message)
    : [...history, pending];
  return {
    kind: 'claimed',
    pending,
    data: { ...current, whatsappSessionId: input.sessionId, whatsappChatId: input.chatId, channel: 'WhatsApp', history: pendingHistory },
  };
}
