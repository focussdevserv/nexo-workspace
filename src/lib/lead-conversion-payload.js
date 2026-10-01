export function leadConversionPayload(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== 'stage'));
}
