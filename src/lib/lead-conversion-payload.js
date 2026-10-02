const CONVERSION_FIELDS = new Set([
  'value', 'chance', 'source', 'service', 'owner', 'nextAction', 'closeDate', 'notes',
]);

/** Fields accepted by the strict lead conversion endpoint. */
export function leadConversionPayload(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => CONVERSION_FIELDS.has(key)));
}

/** Editable record fields to save before conversion (which changes the stage). */
export function leadFieldsBeforeConversion(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'stage'));
}
