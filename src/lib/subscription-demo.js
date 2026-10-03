import { normalizePaymentStatus } from './payment-status.js';

/** In local demo only, allow a pending fake subscription to enter its authorized state. */
export function canSimulateSubscriptionAuthorization(item, demoMode) {
  return Boolean(demoMode) && normalizePaymentStatus(item?.status) === 'pending';
}
