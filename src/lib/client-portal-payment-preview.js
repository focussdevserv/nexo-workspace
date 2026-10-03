import { safeClientPortalHref } from './client-portal-actions.js';

function createdAtDescending(left, right) {
  return new Date(right.createdAt || 0).valueOf() - new Date(left.createdAt || 0).valueOf();
}

function dueAtDescending(left, right) {
  return new Date(right.dueAt || 0).valueOf() - new Date(left.dueAt || 0).valueOf();
}

/** Mirrors the public portal's client join, provider-safe fields, sort, and 100-item limit. */
export function buildClientPortalPaymentPreview(orders = [], subscriptions = [], clientId = '') {
  const belongsToClient = (item) => String(item.workspaceClientId || '') === String(clientId || '');
  const orderPayments = orders.filter(belongsToClient).sort(createdAtDescending).slice(0, 100).map((item) => ({
    id: item.id,
    description: item.description,
    amount: item.amount,
    status: item.status,
    dueAt: item.dueAt,
    hasPixAction: Boolean(item.paymentDetails?.pixCode),
    hasTicketAction: Boolean(safeClientPortalHref(item.paymentDetails?.ticketUrl)),
  }));
  const subscriptionPayments = subscriptions.filter(belongsToClient).sort(createdAtDescending).slice(0, 100).map((item) => ({
    id: item.id,
    description: item.description,
    amount: item.amount,
    status: item.status,
    dueAt: item.nextPaymentAt ?? item.nextDue,
    hasPixAction: false,
    hasTicketAction: false,
  }));

  return [...orderPayments, ...subscriptionPayments].sort(dueAtDescending).slice(0, 100);
}
