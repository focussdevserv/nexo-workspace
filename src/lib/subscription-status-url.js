export function subscriptionStatusUrl(subscriptionId) {
  return `/api/billing/subscriptions/${encodeURIComponent(String(subscriptionId))}/status`;
}
