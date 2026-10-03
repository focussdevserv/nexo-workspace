import { isCurrencyAmount } from './account-ledger.js';

export function isValidFinanceEntryAmount(value: unknown) {
  return typeof value === 'number' && isCurrencyAmount(value);
}
