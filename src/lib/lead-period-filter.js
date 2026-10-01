function leadDate(lead) {
  const value = lead?.createdAt || lead?.created_at || lead?.date;
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function filterLeadsByPeriod(leads, period, now = new Date()) {
  if (period === 'all') return leads;
  const current = now.getTime();
  if (period === 'undated') return leads.filter((lead) => leadDate(lead) === null);
  const days = ({ last7: 7, last30: 30, last90: 90 })[period];
  if (!days) return leads;
  const cutoff = current - days * 24 * 60 * 60 * 1000;
  return leads.filter((lead) => {
    const date = leadDate(lead);
    return date !== null && date >= cutoff && date <= current;
  });
}
