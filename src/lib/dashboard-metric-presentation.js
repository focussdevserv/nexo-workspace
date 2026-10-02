export function dashboardMetricPresentation({
  loading = false,
  restricted = false,
  failed = false,
  value,
  detail,
  restrictedDetail = 'Sem acesso',
  failedDetail = 'Não foi possível carregar',
  loadingDetail = 'Carregando',
}) {
  if (restricted) return { value: '—', detail: restrictedDetail };
  if (loading) return { value: '…', detail: loadingDetail };
  if (failed) return { value: '—', detail: failedDetail };
  return { value: String(value), detail };
}
