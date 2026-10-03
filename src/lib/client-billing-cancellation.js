import { paymentCancellationError } from './payment-cancellation.js';

export function resolveClientBillingCancellation(response, rows = [], requestedId) {
  const error = paymentCancellationError(response);
  if (error) return { error, rows };

  const canceled = response?.data;
  if (!canceled?.id || String(canceled.id) !== String(requestedId)) {
    return {
      error: 'O cancelamento foi confirmado, mas a cobrança retornada não corresponde a este registro. Atualize o status antes de continuar.',
      rows,
    };
  }

  return {
    error: '',
    rows: rows.map((row) => String(row.id) === String(canceled.id) ? canceled : row),
  };
}
