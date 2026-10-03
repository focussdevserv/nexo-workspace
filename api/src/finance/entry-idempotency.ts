import { createHash } from 'node:crypto';

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['code', 'id', 'createdAt', 'updatedAt', 'recurrenceSeriesId', 'recurrenceSequence', 'recurrenceCount', 'recurrenceFrequency'].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalValue(child)]));
  }
  return value;
}

export function financeEntryRequestFingerprint(input: { data: Record<string, unknown>; frequency?: string; count?: number }) {
  const normalized = canonicalValue({ data: input.data, frequency: input.frequency || 'none', count: input.count || 1 });
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function financeEntryIdempotencyDecision(existingFingerprint: string, requestFingerprint: string) {
  return existingFingerprint === requestFingerprint ? 'replay' : 'conflict';
}
