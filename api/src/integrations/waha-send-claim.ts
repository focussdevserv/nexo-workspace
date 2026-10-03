import { createHash } from 'node:crypto';

export type WahaPendingMessage = Record<string, unknown> & {
  clientMessageId: string;
  status: 'sending';
  time: string;
};

export type WahaSendClaim =
  | { kind: 'already_sent'; messageId: string }
  | { kind: 'already_sending'; messageId: string }
  | { kind: 'delivery_unknown'; data: Record<string, unknown> }
  | { kind: 'idempotency_conflict' }
  | { kind: 'claimed'; data: Record<string, unknown>; pending: WahaPendingMessage };

function sendFingerprint(input: { text: string; attachment?: { filename: string; mimeType?: string; contentBase64?: string } }) {
  return createHash('sha256').update(JSON.stringify({
    text: input.text,
    attachment: input.attachment ? {
      filename: input.attachment.filename,
      mimeType: input.attachment.mimeType || 'application/octet-stream',
      contentBase64: input.attachment.contentBase64,
    } : null,
  })).digest('hex');
}

function replaceMessage(history: Array<Record<string, unknown>>, clientMessageId: string, patch: Record<string, unknown>) {
  return history.map((message) => message.clientMessageId === clientMessageId ? { ...message, ...patch } : message);
}

/** Record a failure that happened before a sendText/sendFile POST was started. */
export function markWahaPreflightFailure(current: Record<string, unknown>, clientMessageId: string) {
  const history = Array.isArray(current.history) ? current.history as Array<Record<string, unknown>> : [];
  return {
    ...current,
    history: replaceMessage(history, clientMessageId, { status: 'failed', retryable: true, failureStage: 'preflight' }),
  };
}

/** Ambiguous provider results must never become automatically retryable. */
export function markWahaDeliveryUnknown(current: Record<string, unknown>, clientMessageId: string, fallback?: Record<string, unknown>) {
  const history = Array.isArray(current.history) ? current.history as Array<Record<string, unknown>> : [];
  const found = history.some((message) => message.clientMessageId === clientMessageId);
  const nextHistory = replaceMessage(history, clientMessageId, { status: 'unknown', retryable: false, failureStage: 'delivery_unknown' });
  if (!found && fallback?.clientMessageId === clientMessageId) {
    nextHistory.push({ ...fallback, status: 'unknown', retryable: false, failureStage: 'delivery_unknown' });
  }
  return {
    ...current,
    history: nextHistory,
  };
}

/** Decide whether a message ID may be sent while the caller holds the conversation row lock. */
export function claimWahaMessage(
  current: Record<string, unknown>,
  input: { sessionId: string; chatId: string; clientMessageId: string; text: string; attachment?: { filename: string; mimeType?: string; contentBase64?: string } },
  now = new Date(),
): WahaSendClaim {
  const history = Array.isArray(current.history) ? current.history as Array<Record<string, unknown>> : [];
  const duplicate = history.find((message) => message.clientMessageId === input.clientMessageId);
  if (duplicate && ['sent', 'delivered', 'read'].includes(String(duplicate.status))) {
    return { kind: 'already_sent', messageId: String(duplicate.providerMessageId || duplicate.clientMessageId) };
  }
  if (duplicate && duplicate.status === 'failed' && duplicate.retryable === true && duplicate.failureStage === 'preflight') {
    if (!duplicate.requestFingerprint || duplicate.requestFingerprint !== sendFingerprint(input)) return { kind: 'idempotency_conflict' };
  } else if (duplicate) {
    const pendingAge = now.getTime() - Date.parse(String(duplicate.createdAt || ''));
    if (duplicate.status === 'sending' && pendingAge >= 0 && pendingAge < 30_000) {
      return { kind: 'already_sending', messageId: String(duplicate.clientMessageId) };
    }
    return { kind: 'delivery_unknown', data: markWahaDeliveryUnknown(current, input.clientMessageId) };
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
    requestFingerprint: sendFingerprint(input),
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
