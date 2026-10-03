import { normalizeBillingSubscriptionStatus, type BillingSubscriptionStatus } from './subscription-transitions.js';

/**
 * Mercado Pago can return HTTP 200 while the preapproval remains in its prior
 * state. Only persist a pause/resume/cancel locally when the provider's
 * response confirms the requested state.
 */
export function confirmsSubscriptionStatus(
  providerResponse: unknown,
  requestedStatus: BillingSubscriptionStatus,
): boolean {
  if (!providerResponse || typeof providerResponse !== 'object') return false;
  const status = (providerResponse as { status?: unknown }).status;
  return normalizeBillingSubscriptionStatus(status) === requestedStatus;
}
