function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : '';
}

function normalizePhone(value) {
  const digits = typeof value === 'string' ? value.replace(/\D/g, '') : '';
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}

export function findLeadDuplicateMatch(records, candidate) {
  const email = normalizeEmail(candidate?.email);
  const phone = normalizePhone(candidate?.phone);
  if (!email && !phone) return { kind: 'none' };
  const matches = (Array.isArray(records) ? records : []).filter((record) =>
    (email && normalizeEmail(record?.email) === email) || (phone && normalizePhone(record?.phone) === phone));
  const unique = new Map(matches.map((record, index) => [record?.id == null ? `row-${index}` : String(record.id), record]));
  if (unique.size > 1) return { kind: 'ambiguous' };
  const record = unique.values().next().value;
  return record ? { kind: 'match', record } : { kind: 'none' };
}
