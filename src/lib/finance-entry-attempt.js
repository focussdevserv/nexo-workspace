function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['code', 'id', 'createdAt', 'updatedAt', 'recurrenceSeriesId', 'recurrenceSequence', 'recurrenceCount', 'recurrenceFrequency'].includes(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
  return value;
}

export function financeEntryAttemptFingerprint(data, frequency = 'none', count = 1) {
  return JSON.stringify(stableValue({ data, frequency, count }));
}

export function getFinanceEntryAttempt(current, fingerprint, createKey = () => globalThis.crypto.randomUUID()) {
  return current?.fingerprint === fingerprint ? current : { fingerprint, key: createKey() };
}
