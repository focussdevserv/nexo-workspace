function usableTimestamp(value: unknown) {
  if (typeof value !== 'string' && !(value instanceof Date)) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function providerPaidAt(details: Record<string, unknown>) {
  return usableTimestamp(details.paidAt ?? details.dateApproved ?? details.date_approved);
}

export function withStableBillingPaidAt(
  currentStatus: string,
  nextStatus: string,
  currentDetails: Record<string, unknown> = {},
  incomingDetails: Record<string, unknown> = {},
  previousUpdatedAt?: unknown,
  transitionAt: Date = new Date(),
) {
  const next = { ...incomingDetails };
  if (nextStatus !== 'paid') return next;

  const currentPaidAt = usableTimestamp(currentDetails.paidAt);
  const providerTimestamp = providerPaidAt(incomingDetails);
  const previousTimestamp = usableTimestamp(previousUpdatedAt);
  const transitionTimestamp = usableTimestamp(transitionAt) || new Date().toISOString();
  next.paidAt = currentStatus === 'paid'
    ? currentPaidAt || providerTimestamp || previousTimestamp || transitionTimestamp
    : providerTimestamp || transitionTimestamp;
  return next;
}
