const STATUS_ALIASES = new Map([
  ['cancelled', 'canceled'],
  ['paga', 'paid'],
  ['pago', 'paid'],
  ['recebida', 'paid'],
  ['recebido', 'paid'],
  ['aguardando pagamento', 'pending'],
  ['em processamento', 'processing'],
  ['autorizada', 'authorized'],
  ['pausada', 'paused'],
  ['cancelada', 'canceled'],
  ['vencida', 'overdue'],
  ['atrasada', 'overdue'],
  ['falhou', 'failed'],
  ['estornada', 'refunded'],
  ['recusada', 'rejected'],
  ['expirada', 'expired'],
]);

export function normalizePaymentStatus(status) {
  const normalized = String(status || '').trim().toLocaleLowerCase('pt-BR');
  return STATUS_ALIASES.get(normalized) || normalized;
}

export function canCancelPaymentOrder(item, demoMode = false) {
  if (normalizePaymentStatus(item?.status) !== 'pending') return false;
  const providerStatus = normalizePaymentStatus(item?.paymentDetails?.status);
  return demoMode || ['created', 'action_required'].includes(providerStatus);
}

export function canCancelSubscription(item) {
  return ['pending', 'authorized', 'paused'].includes(normalizePaymentStatus(item?.status));
}
