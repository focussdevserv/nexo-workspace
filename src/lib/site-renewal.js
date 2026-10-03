function parseRenewalParts(value) {
  const raw = String(value ?? '').trim();
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  return null;
}

function validParts(parts) {
  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return false;
  const parsed = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return parsed.getUTCFullYear() === parts.year && parsed.getUTCMonth() === parts.month - 1 && parsed.getUTCDate() === parts.day;
}

export function siteRenewalDaysUntil(value, today = new Date()) {
  const renewalDate = siteRenewalDate(value);
  if (!renewalDate) return null;
  const current = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  const todayUtc = Date.UTC(current.year, current.month - 1, current.day);
  const renewalUtc = Date.UTC(renewalDate.getFullYear(), renewalDate.getMonth(), renewalDate.getDate());
  return Math.round((renewalUtc - todayUtc) / 86_400_000);
}

export function siteRenewalDate(value) {
  const parts = parseRenewalParts(value);
  if (!validParts(parts)) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function summarizeSiteRenewals(assets = [], today = new Date()) {
  return assets.reduce((summary, asset) => {
    const days = siteRenewalDaysUntil(asset?.renewalDate || asset?.renewal, today);
    if (days === null) summary.missing += 1;
    else if (days < 0) summary.overdue += 1;
    else if (days <= 30) summary.soon += 1;
    else summary.upcoming += 1;
    return summary;
  }, { overdue: 0, soon: 0, missing: 0, upcoming: 0 });
}
