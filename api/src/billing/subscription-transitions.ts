export type BillingSubscriptionStatus = 'pending' | 'authorized' | 'paused' | 'canceled';

export function normalizeBillingSubscriptionStatus(status: unknown): BillingSubscriptionStatus | null {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'cancelled' || value === 'canceled') return 'canceled';
  if (value === 'pending' || value === 'authorized' || value === 'paused') return value;
  return null;
}

export function canTransitionBillingSubscription(currentStatus: unknown, nextStatus: BillingSubscriptionStatus): boolean {
  const current = normalizeBillingSubscriptionStatus(currentStatus);
  if (!current) return false;
  if (current === nextStatus) return true;
  if (nextStatus === 'canceled') return ['pending', 'authorized', 'paused'].includes(current);
  if (nextStatus === 'paused') return current === 'authorized';
  if (nextStatus === 'authorized') return current === 'paused';
  return false;
}
