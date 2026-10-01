export function normalizeLeadEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
}

export function normalizeLeadPhone(value: unknown) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

export function findDuplicateLead<T extends { id?: unknown; email?: unknown; phone?: unknown }>(leads: T[], candidate: { email?: unknown; phone?: unknown }) {
  const email = normalizeLeadEmail(candidate.email);
  const phone = normalizeLeadPhone(candidate.phone);
  if (!email && !phone) return undefined;
  return leads.find((lead) => (email && normalizeLeadEmail(lead.email) === email) || (phone && normalizeLeadPhone(lead.phone) === phone));
}
