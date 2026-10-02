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

export function findLeadDuplicateMatch<T extends { id?: unknown; email?: unknown; phone?: unknown }>(leads: T[], candidate: { email?: unknown; phone?: unknown }) {
  const email = normalizeLeadEmail(candidate.email);
  const phone = normalizeLeadPhone(candidate.phone);
  if (!email && !phone) return { kind: 'none' as const };
  const matches = leads.filter((lead) => (email && normalizeLeadEmail(lead.email) === email) || (phone && normalizeLeadPhone(lead.phone) === phone));
  const uniqueMatches = new Map(matches.map((lead, index) => [lead.id == null ? `row-${index}` : String(lead.id), lead]));
  if (uniqueMatches.size > 1) return { kind: 'ambiguous' as const };
  const match = uniqueMatches.values().next().value as T | undefined;
  return match ? { kind: 'match' as const, record: match } : { kind: 'none' as const };
}
