function normalizeSearchValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function matchesPaymentSearch(item, query) {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return true;
  const searchable = [item?.clientName, item?.description, item?.status, item?.payerEmail, item?.method]
    .map(normalizeSearchValue)
    .join(' ');
  return searchable.includes(normalizedQuery);
}
