import { normalizePaymentStatus } from './payment-status.js';

export function paymentCancellationError(response) {
  const status = normalizePaymentStatus(response?.data?.status);
  if (status === 'canceled') return '';
  if (response?.status === 'demo_only' && response?.message) return String(response.message);
  return 'O cancelamento não foi confirmado. Atualize o status da cobrança antes de tentar novamente.';
}

export function subscriptionCancellationError(response, expectedId) {
  const receivedId = response?.data?.id == null ? '' : String(response.data.id);
  if (!expectedId || !receivedId || receivedId !== String(expectedId)) {
    return 'O cancelamento da assinatura n\u00e3o foi confirmado para este registro. Atualize a lista antes de tentar novamente.';
  }
  if (normalizePaymentStatus(response?.data?.status) === 'canceled') return '';
  if (response?.status === 'demo_only' && response?.message) return String(response.message);
  return 'O cancelamento da assinatura n\u00e3o foi confirmado. Atualize o status antes de tentar novamente.';
}
