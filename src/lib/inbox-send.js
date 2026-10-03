/** Deliver once, clear the composer, then refresh without treating refresh errors as send failures. */
export function whatsappSendPreflight({ sessionId, chatId, localDemo = false }) {
  if (!sessionId) return 'session';
  if (!localDemo && !chatId) return 'recipient';
  return null;
}

export async function sendInboxMessage({ deliver, onSent, refresh, onDeliveryError }) {
  let delivery;
  try {
    delivery = await deliver();
  } catch (error) {
    try { await onDeliveryError?.(error); } catch { /* Preserve the original delivery error. */ }
    throw error;
  }
  if (delivery?.data?.status === 'sending') {
    try { await refresh(); } catch { /* Keep the composer available while the existing attempt settles. */ }
    return { sent: false, refreshed: false, simulated: false, pending: true };
  }
  const simulated = delivery?.data?.simulated === true;
  onSent();
  try {
    await refresh();
    return { sent: true, refreshed: true, simulated };
  } catch {
    return { sent: true, refreshed: false, simulated };
  }
}
