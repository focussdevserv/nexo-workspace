export function automationDeliveryActions(delivery) {
  if (!delivery) return [];
  const overdue = delivery.deliveryType === 'billing_overdue';
  const actions = [];
  if (delivery.status === 'discarded' && delivery.retryable) actions.push({ action: 'retry', label: overdue ? 'Reprocessar cobrança' : 'Reprocessar' });
  if (delivery.status === 'pending') actions.push({ action: 'discard', label: overdue ? 'Ignorar cobrança' : 'Descartar' });
  return actions;
}

export function automationDeliveryActionUrl(id, action) {
  if (!['retry', 'discard'].includes(action)) throw new TypeError('Ação de entrega inválida.');
  return `/api/integrations/n8n/deliveries/${encodeURIComponent(id)}/${action}`;
}
