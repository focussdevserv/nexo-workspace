export function clientContactActions(email, phone) {
  const address = String(email || '').trim();
  const validEmail = address.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
  const phoneValue = String(phone || '').trim();
  const digits = phoneValue.replace(/\D/g, '');
  const brazilianLocal = [10, 11].includes(digits.length);
  const international = phoneValue.startsWith('+') || (digits.startsWith('55') && [12, 13].includes(digits.length));
  const whatsappNumber = brazilianLocal ? `55${digits}` : international && digits.length >= 8 && digits.length <= 15 ? digits : '';
  return {
    emailHref: validEmail ? `mailto:${address}` : '',
    whatsappHref: whatsappNumber ? `https://wa.me/${whatsappNumber}` : '',
  };
}
