export function publicLeadFormManagerState({ isOwner, localDemo }) {
  return { visible: isOwner === true, available: isOwner === true && localDemo === false };
}

export function publicLeadPayload(values, startedAt) {
  const phoneDigits = String(values.phone || '').replace(/\D/g, '');
  return {
    name: String(values.name || '').trim(),
    email: String(values.email || '').trim(),
    phone: phoneDigits.length >= 8 && phoneDigits.length <= 15 ? String(values.phone || '').trim() : '',
    company: String(values.company || '').trim(),
    message: String(values.message || '').trim(),
    contactConsent: values.contactConsent === true,
    marketingConsent: values.marketingConsent === true,
    website: String(values.website || ''),
    startedAt,
  };
}

export function publicLeadHasContact({ email = '', phone = '' } = {}) {
  const digits = String(phone).replace(/\D/g, '');
  return Boolean(String(email).trim()) || (digits.length >= 8 && digits.length <= 15);
}

export function publicLeadSlugFromPath(pathname) {
  const match = /^\/captura\/([A-Za-z0-9_-]{24,64})\/?$/.exec(pathname);
  return match?.[1] || null;
}
