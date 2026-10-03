/** Deliver once, clear the composer, then refresh without treating refresh errors as send failures. */
export async function sendInboxMessage({ deliver, onSent, refresh }) {
  const delivery = await deliver();
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
