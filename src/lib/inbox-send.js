/** Deliver once, clear the composer, then refresh without treating refresh errors as send failures. */
export async function sendInboxMessage({ deliver, onSent, refresh }) {
  await deliver();
  onSent();
  try {
    await refresh();
    return { sent: true, refreshed: true };
  } catch {
    return { sent: true, refreshed: false };
  }
}
