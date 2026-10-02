/**
 * Keep outbound WhatsApp sends bound to the recipient stored on the selected
 * workspace conversation. A workspace session is shared infrastructure, so
 * trusting a client supplied chat ID alone would let a modified request send
 * to an unrelated number.
 */
export function isWahaChatIdBoundToConversation(
  requestedChatId: string,
  conversation: { whatsappChatId?: unknown; phone?: unknown },
): boolean {
  const chatId = String(requestedChatId || '').trim();
  if (!/^[\w.+-]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|newsletter)$/.test(chatId)) return false;

  const storedChatId = String(conversation.whatsappChatId || '').trim();
  if (storedChatId) return chatId === storedChatId;

  // Older/manual conversations may not yet have a WAHA chat ID. Allow the
  // canonical phone target only when it matches the saved phone field.
  let phoneDigits = String(conversation.phone || '').replace(/\D/g, '');
  const internationalPrefix = /^\s*\+/.test(String(conversation.phone || ''));
  if (!internationalPrefix && (phoneDigits.length === 10 || phoneDigits.length === 11)) phoneDigits = `55${phoneDigits}`;
  if (phoneDigits.length < 8 || phoneDigits.length > 15) return false;
  return chatId === `${phoneDigits}@c.us`;
}
