export type BillingPaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'debit_card';

export function billingMethodPreferenceAllows(method: BillingPaymentMethod, preferences: unknown): boolean {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return true;
  const settings = preferences as Record<string, unknown>;
  const key = method === 'pix' ? 'pix' : method === 'boleto' ? 'boleto' : 'card';
  return settings[key] !== false;
}
