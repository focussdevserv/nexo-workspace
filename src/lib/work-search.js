export function normalizeWorkSearchText(value, locale = 'pt-BR') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(locale)
    .trim();
}

export function matchesWorkSearch(fields, query, locale = 'pt-BR') {
  const needle = normalizeWorkSearchText(query, locale);
  if (!needle) return true;
  const haystack = normalizeWorkSearchText((Array.isArray(fields) ? fields : [fields]).filter((value) => value != null).join(' '), locale);
  return haystack.includes(needle);
}
