const CARD_METHODS = new Set(['credit_card', 'debit_card']);

/** Determine which actionable instructions can be shown for a provider result. */
export function paymentResultInstructionKind(result = {}) {
  const details = result.paymentDetails && typeof result.paymentDetails === 'object'
    ? result.paymentDetails
    : {};
  if (details.pixQrCodeBase64 || details.pixCode) return 'pix';
  if (details.ticketUrl) return 'boleto';
  if (CARD_METHODS.has(result.method)) return 'card';
  return 'unavailable';
}
