const normalizeServiceName = (value) => String(value ?? '').trim().toLocaleLowerCase('pt-BR');

export function resolveCommercialServiceByName(services = [], name = '') {
  const normalizedName = normalizeServiceName(name);
  if (!normalizedName) return { service: null, ambiguous: false };
  const matches = services.filter((service) => normalizeServiceName(service?.name) === normalizedName);
  return {
    service: matches.length === 1 ? matches[0] : null,
    ambiguous: matches.length > 1,
  };
}
