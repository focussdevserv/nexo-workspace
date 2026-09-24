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
