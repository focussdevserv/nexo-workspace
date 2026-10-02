export function normalizeApprovalStatus(status) {
  return String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function isApprovalAwaitingDecision(status) {
  return normalizeApprovalStatus(status) === 'aguardando';
}

export function isApprovalPending(status) {
  return ['aguardando', 'alteracoes solicitadas', 'ajustes solicitados'].includes(normalizeApprovalStatus(status));
}
