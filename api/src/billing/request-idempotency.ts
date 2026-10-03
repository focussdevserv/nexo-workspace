import { createHash } from 'node:crypto';

export type BillingIdempotencyState = 'creating' | 'failed' | 'completed';
export type BillingIdempotencyDecision = 'new' | 'retry' | 'in_progress' | 'replay' | 'conflict';

export function billingRequestIdempotencyKey(header: unknown) {
  if (header === undefined) return { key: null, valid: true } as const;
  if (typeof header !== 'string') return { key: null, valid: false } as const;
  const key = header.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)
    ? { key, valid: true } as const
    : { key: null, valid: false } as const;
}

function sortForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortForHash(child)]));
}

/** Hash the normalized request body so the idempotency key cannot be reused for different billing details. */
export function billingRequestFingerprint(value: unknown) {
  // Card token is a one-use provider credential that can change when the client retries
  // an otherwise identical card form. It must not create a second billing operation.
  const request = value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'cardToken'))
    : value;
  return createHash('sha256').update(JSON.stringify(sortForHash(request))).digest('hex');
}

export function decideBillingIdempotencyReplay(existingFingerprint: string, requestFingerprint: string, state: BillingIdempotencyState): BillingIdempotencyDecision {
  if (existingFingerprint !== requestFingerprint) return 'conflict';
  if (state === 'failed') return 'retry';
  if (state === 'creating') return 'in_progress';
  return 'replay';
}
