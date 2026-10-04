export function dashboardCountLabel({ count = 0, loading = false, failed = false, restricted = false, singular, plural, countOnly = false }) {
  if (restricted) return 'Sem acesso';
  if (loading) return 'Carregando…';
  if (failed) return 'Não foi possível carregar';
  const safeCount = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  if (countOnly) return String(safeCount);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}
