const PAYMENT_NAVIGATION_FIELDS = [
  'intentId',
  'filter',
  'action',
  'clientId',
  'clientName',
  'clientEmail',
  'description',
  'amount',
  'frequency',
  'frequencyInterval',
  'installmentServiceId',
  'installmentIndex',
  'installmentCount',
];

/** Stable dependency key for every value that can prefill the billing screen. */
export function paymentNavigationContextKey(context) {
  if (!context) return '';
  return JSON.stringify(PAYMENT_NAVIGATION_FIELDS.map((field) => context[field] ?? null));
}
