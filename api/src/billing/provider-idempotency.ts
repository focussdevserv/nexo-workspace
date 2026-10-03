import { createHash } from 'node:crypto';

/** Create a stable UUID for one provider operation on one persisted workspace record. */
export function billingProviderIdempotencyKey(operation: 'order-create' | 'order-cancel' | 'subscription-create', recordId: string) {
  const digest = createHash('sha256').update(`focusshub:mercadopago:${operation}:${recordId}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  // Mark as a custom SHA-256 UUID and set the RFC 4122 variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
