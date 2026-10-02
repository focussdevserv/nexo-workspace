const pendingStatuses = new Set([
  '', 'aberta', 'aberto', 'aguardando', 'aguardando pagamento', 'atrasada', 'em atraso', 'em aberto', 'over due', 'overdue', 'pending', 'pendente', 'vencida', 'vencido', 'open', 'processing', 'creating', 'action required',
]);

const removableStatuses = new Set([
  'cancelada', 'cancelado', 'canceled', 'cancelled', 'estornada', 'estornado', 'refunded',
  'paga', 'pago', 'recebida', 'recebido', 'paid', 'settled', 'received', 'quitada', 'quitado', 'liquidada', 'liquidado',
]);

function normalizeStatus(status) {
  return String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function financeEntryActionForStatus(status) {
  const normalized = normalizeStatus(status);
  if (pendingStatuses.has(normalized)) return 'settle';
  if (removableStatuses.has(normalized)) return 'delete';
  return 'unsupported';
}
