export function shouldConfirmPortalLinkRotation(portalActive) {
  return portalActive === true;
}

export function portalLinkActionLabel(portalActive) {
  return portalActive ? 'Substituir link atual' : 'Gerar link seguro';
}

export function splitClientPortalApprovals(approvals = []) {
  const pending = [];
  const history = [];
  for (const item of Array.isArray(approvals) ? approvals : []) {
    const status = String(item?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
    if (['aguardando', 'alteracoes solicitadas', 'ajustes solicitados'].includes(status)) pending.push(item);
    else history.push(item);
  }
  return { pending, history };
}

export function canSubmitPortalApprovalDecision(decision, comment, busy = false) {
  if (busy) return false;
  if (decision === 'changes_requested') return String(comment || '').trim().length >= 3;
  return decision === 'approved';
}

export function canSendPortalMessage(message, busy = false) {
  return !busy && String(message || '').trim().length > 0;
}

export function appendSentPortalMessage(messages = [], message, responseId = '') {
  const text = String(message || '').trim();
  if (!text) return Array.isArray(messages) ? messages : [];
  const current = Array.isArray(messages) ? messages : [];
  if (responseId && current.some((item) => String(item.id) === String(responseId))) return current;
  return [{ id: responseId || `local-${Date.now()}`, text, sentAt: new Date().toISOString() }, ...current];
}
