import { isCurrencyAmount } from '../integrations/account-ledger.js';

// Mercado Pago only accepts BRL amounts representable in cents. Keep the
// same upper bound used by the billing request schemas.
export function isSupportedBillingAmount(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000 && isCurrencyAmount(value);
}
