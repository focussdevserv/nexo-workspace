import { createHash } from 'node:crypto';

export type GmailDeliveryState = 'sending' | 'sent' | 'retryable' | 'unknown';

export type GmailDeliveryRecord = {
  state: GmailDeliveryState;
  fingerprint: string;
  startedAt: string;
  attempts: number;
  messageId?: string;
  threadId?: string;
};

export type GmailDeliveryReservation =
  | { kind: 'claimed' }
  | { kind: 'sent'; record: GmailDeliveryRecord }
  | { kind: 'sending' }
  | { kind: 'unknown' }
  | { kind: 'conflict' };

export function gmailDeliveryFingerprint(input: {
  operation: 'send' | 'reply';
  threadId?: string;
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; mimeType: string; contentBase64: string }>;
}) {
  return createHash('sha256').update(JSON.stringify({
    operation: input.operation,
    threadId: input.threadId || '',
    to: input.to.trim().toLocaleLowerCase('en-US'),
    subject: input.subject,
    text: input.text,
    attachments: (input.attachments || []).map(({ filename, mimeType, contentBase64 }) => ({ filename, mimeType, contentBase64 })),
  })).digest('hex');
}

export function decideGmailDeliveryReservation(
  existing: GmailDeliveryRecord | null,
  fingerprint: string,
  now = new Date(),
  staleAfterMs = 30_000,
): GmailDeliveryReservation {
  if (!existing) return { kind: 'claimed' };
  if (existing.fingerprint !== fingerprint) return { kind: 'conflict' };
  if (existing.state === 'sent') return { kind: 'sent', record: existing };
  if (existing.state === 'unknown') return { kind: 'unknown' };
  if (existing.state === 'sending') {
    const age = now.getTime() - Date.parse(existing.startedAt);
    return age >= 0 && age < staleAfterMs ? { kind: 'sending' } : { kind: 'unknown' };
  }
  if (existing.state === 'retryable') return { kind: 'claimed' };
  return { kind: 'unknown' };
}

export type GmailProviderResult = {
  ok: boolean;
  status: number;
  json(): Promise<{ id?: string; threadId?: string }>;
};

export type GmailDeliveryAttemptResult =
  | { kind: 'sent'; messageId: string; threadId?: string; duplicate?: boolean }
  | { kind: 'sending' }
  | { kind: 'unknown' }
  | { kind: 'conflict' }
  | { kind: 'preflight_failed'; error: unknown }
  | { kind: 'rejected'; status: number };

/**
 * Runs a Gmail delivery behind a durable reservation. Any uncertain result
 * after the provider call starts is terminal; only failures before the call
 * or explicit 4xx rejections may be retried with the same key and payload.
 */
export async function runGmailDeliveryAttempt({
  reserve,
  prepare,
  deliver,
  markRetryable,
  markUnknown,
  markSent,
}: {
  reserve: () => Promise<GmailDeliveryReservation>;
  prepare: () => Promise<unknown>;
  deliver: (prepared: unknown) => Promise<GmailProviderResult>;
  markRetryable: () => Promise<void>;
  markUnknown: () => Promise<void>;
  markSent: (messageId: string, threadId?: string) => Promise<void>;
}): Promise<GmailDeliveryAttemptResult> {
  const reservation = await reserve();
  if (reservation.kind === 'sent') return {
    kind: 'sent', messageId: reservation.record.messageId || '', threadId: reservation.record.threadId, duplicate: true,
  };
  if (reservation.kind !== 'claimed') return reservation;

  let prepared: unknown;
  try {
    prepared = await prepare();
  } catch (error) {
    await markRetryable().catch(() => {});
    return { kind: 'preflight_failed', error };
  }

  let response: GmailProviderResult;
  try {
    response = await deliver(prepared);
  } catch {
    await markUnknown().catch(() => {});
    return { kind: 'unknown' };
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      await markRetryable().catch(() => {});
      return { kind: 'rejected', status: response.status };
    }
    await markUnknown().catch(() => {});
    return { kind: 'unknown' };
  }

  let result: { id?: string; threadId?: string };
  try {
    result = await response.json();
  } catch {
    await markUnknown().catch(() => {});
    return { kind: 'unknown' };
  }
  if (!result.id) {
    await markUnknown().catch(() => {});
    return { kind: 'unknown' };
  }

  try {
    await markSent(result.id, result.threadId);
  } catch {
    // The provider may have sent it, but the durable success write failed.
    // The original 'sending' claim will become terminally unknown on retry.
    await markUnknown().catch(() => {});
    return { kind: 'unknown' };
  }
  return { kind: 'sent', messageId: result.id, threadId: result.threadId };
}
