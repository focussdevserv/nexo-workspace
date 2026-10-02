import { z } from 'zod';

export type SubscriptionDateError = 'start_in_past' | 'end_before_start';

// Billing forms send São Paulo timestamps with an explicit -03:00 offset.
// Zod's default datetime validator only accepts UTC timestamps ending in Z.
export const subscriptionDateTimeSchema = z.string().datetime({ offset: true });

export function validateSubscriptionDates(
  startAt?: string,
  endAt?: string,
  now = Date.now(),
): SubscriptionDateError | null {
  const start = startAt ? Date.parse(startAt) : now;
  const end = endAt ? Date.parse(endAt) : null;
  if (startAt && start <= now) return 'start_in_past';
  if (end !== null && end <= start) return 'end_before_start';
  return null;
}
