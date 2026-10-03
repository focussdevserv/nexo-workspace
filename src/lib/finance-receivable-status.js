const closedStatuses = new Set([
  'paid', 'received', 'settled', 'authorized', 'processed',
  'paga', 'pago', 'recebida', 'recebido', 'quitada', 'quitado', 'liquidada', 'liquidado',
  'canceled', 'cancelled', 'cancelada', 'cancelado', 'refunded', 'estornada', 'estornado',
  'failed', 'failure', 'rejected', 'declined', 'refused', 'expired', 'voided', 'chargeback',
  'payment failed', 'payment rejected', 'payment expired', 'authorization failed',
  'falhou', 'falha', 'recusada', 'recusado', 'rejeitada', 'rejeitado', 'expirada', 'expirado',
  'autorizacao falhou', 'cobranca estornada',
]);

export function isFinanceReceivableStatusOpen(status) {
  const normalized = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return !closedStatuses.has(normalized);
}
