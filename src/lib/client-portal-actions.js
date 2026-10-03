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

/** Payment instructions are actionable only while the invoice remains payable. */
export function canOfferClientPortalPaymentAction(status) {
  return ['pending', 'overdue'].includes(normalizePaymentStatus(status));
}

/** A synchronous guard for UI actions whose React disabled state updates on the next render. */
export function createClientPortalActionLock() {
  let locked = false;
  return {
    acquire() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
  };
}

export function acquireClientPortalActionAfterConfirmation(lock, needsConfirmation, confirmAction) {
  if (needsConfirmation && !confirmAction()) return false;
  return lock.acquire();
}

/** Only expose web URLs or same-origin root-relative paths as public links. */
import { normalizePaymentStatus } from './payment-status.js';

export function safeClientPortalHref(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || /[\\\u0000-\u001f]/.test(candidate) || candidate.startsWith('//')) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('/\\')) return candidate;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export async function copyPortalLink(text, { clipboard = globalThis.navigator?.clipboard, documentRef = globalThis.document } = {}) {
  const value = String(text || '');
  if (!value.trim()) throw new Error('O link do portal está vazio.');

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return 'clipboard';
    } catch {
      // Clipboard permissions are often unavailable in HTTP pages and embedded browsers.
    }
  }

  if (!documentRef?.body || !documentRef.createElement || !documentRef.execCommand) {
    throw new Error('Este navegador não permite copiar o link.');
  }

  const field = documentRef.createElement('textarea');
  const previousFocus = documentRef.activeElement;
  field.value = value;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  documentRef.body.appendChild(field);
  try {
    field.focus();
    field.select();
    if (!documentRef.execCommand('copy')) throw new Error('A cópia foi recusada pelo navegador.');
    return 'legacy';
  } finally {
    field.remove();
    previousFocus?.focus?.();
  }
}

export function appendSentPortalMessage(messages = [], message, responseId = '') {
  const text = String(message || '').trim();
  if (!text) return Array.isArray(messages) ? messages : [];
  const current = Array.isArray(messages) ? messages : [];
  if (responseId && current.some((item) => String(item.id) === String(responseId))) return current;
  return [{ id: responseId || `local-${Date.now()}`, text, sentAt: new Date().toISOString() }, ...current];
}
