export type OverdueBillingOrder = {
  id: string;
  clientId: string | null;
  clientName: string;
  description: string;
  amount: number;
  status: string;
  dueAt: Date | null;
};

export function buildOverduePaymentEvent(order: OverdueBillingOrder, now = new Date()) {
  if (order.status !== 'pending' || !order.dueAt || order.dueAt.getTime() > now.getTime()) return null;
  return {
    id: order.id,
    billingOrderId: order.id,
    clientId: order.clientId,
    client: order.clientName,
    title: order.description,
    amount: order.amount,
    dueAt: order.dueAt.toISOString(),
  };
}

export function overduePaymentRetryDelayMs(attempt: number) {
  const boundedAttempt = Math.max(1, Math.min(10, Math.trunc(attempt) || 1));
  return Math.min(60 * 60_000, 30_000 * (2 ** (boundedAttempt - 1)));
}

export const OVERDUE_PAYMENT_MAX_ATTEMPTS = 8;

export function overduePaymentDeliveryExhausted(attempts: number) {
  return attempts >= OVERDUE_PAYMENT_MAX_ATTEMPTS;
}

export function overduePaymentCanRetry(
  event: { deliveredAt: Date | null; discardedAt: Date | null },
  context: { orderIsDue: boolean; integrationEnabled: boolean; hasActiveAutomation: boolean },
) {
  return Boolean(event.discardedAt && !event.deliveredAt)
    && context.orderIsDue
    && context.integrationEnabled
    && context.hasActiveAutomation;
}

export function overduePaymentHistoryEntryId(id: string) {
  return `overdue:${id}`;
}

export function parseOverduePaymentHistoryEntryId(id: string) {
  return id.startsWith('overdue:') ? id.slice('overdue:'.length) : null;
}
