export function billingSubscriptionPreferenceAllows(preferences: unknown): boolean {
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) return true;
  return (preferences as Record<string, unknown>).autoRenew !== false;
}
