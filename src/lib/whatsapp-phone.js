export function normalizeWhatsAppChatId(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  const internationalPrefix = /^\s*\+/.test(String(phone || ''));
  if (!internationalPrefix && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
  if (digits.length < 8 || digits.length > 15) return '';
  return `${digits}@c.us`;
}
