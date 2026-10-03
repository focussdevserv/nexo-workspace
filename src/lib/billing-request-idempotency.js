import { createRequestUuid } from './request-id.js';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
}

export function billingPayloadFingerprint(operation, payload) {
  const stablePayload = payload && typeof payload === 'object'
    ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'cardToken'))
    : payload;
  return `${operation}:${JSON.stringify(stableValue(stablePayload))}`;
}

export function reuseBillingRequestKey(currentAttempt, operation, payload, createKey) {
  const fingerprint = billingPayloadFingerprint(operation, payload);
  if (currentAttempt?.fingerprint === fingerprint && currentAttempt.key) return currentAttempt;
  return { fingerprint, key: createKey() };
}

export function createBillingRequestUuid() {
  return createRequestUuid();
}
