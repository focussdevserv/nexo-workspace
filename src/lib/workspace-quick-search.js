function normalizeSearchText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function workspaceQuickSearchResults(query, pages = [], canOpenPage = () => true, limit = 8) {
  const normalizedQuery = normalizeSearchText(query);
  const safeLimit = Math.max(0, Math.floor(Number(limit) || 0));
  if (!safeLimit) return [];

  return [...new Set(pages.filter((page) => typeof page === 'string' && page.trim()))]
    .filter((page) => canOpenPage(page) && (!normalizedQuery || normalizeSearchText(page).includes(normalizedQuery)))
    .slice(0, safeLimit);
}
