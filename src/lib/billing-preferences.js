export function recurringBillingEnabled(billingPreferences) {
  return billingPreferences?.autoRenew !== false;
}
