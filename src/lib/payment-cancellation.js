import { normalizePaymentStatus } from './payment-status.js';

export function paymentCancellationError(response) {
  const status = normalizePaymentStatus(response?.data?.status);
  if (status === 'canceled') return '';
  if (response?.status === 'demo_only' && response?.message) return String(response.message);
  return 'O cancelamento não foi confirmado. Atualize o status da cobrança antes de tentar novamente.';
}
