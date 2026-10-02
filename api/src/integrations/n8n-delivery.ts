export const N8N_DELIVERY_MAX_ATTEMPTS = 8;

const retryDelaysMs = [30_000, 120_000, 600_000, 1_800_000, 3_600_000, 7_200_000, 14_400_000];

export function n8nDeliveryRetryDelayMs(attempt: number) {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1;
  return retryDelaysMs[Math.min(safeAttempt - 1, retryDelaysMs.length - 1)]!;
}

export function n8nDeliveryExhausted(attempts: number) {
  return attempts >= N8N_DELIVERY_MAX_ATTEMPTS;
}

export function n8nDeliveryCanRetry(delivery: { discardedAt: Date | null; deliveredAt: Date | null; record: Record<string, unknown> }) {
  return Boolean(delivery.discardedAt && !delivery.deliveredAt && delivery.record && Object.keys(delivery.record).length);
}

export function n8nCallbackRejectionReason(input: {
  integrationEnabled: boolean;
  automationActive: boolean;
  automationEventKey: unknown;
  incomingEventKey: string;
}) {
  if (!input.integrationEnabled) return 'integration_disconnected';
  if (!input.automationActive || input.automationEventKey !== input.incomingEventKey) return 'automation_not_found';
  return null;
}
