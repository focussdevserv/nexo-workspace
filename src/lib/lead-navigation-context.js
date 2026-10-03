export function resolveLeadNavigation(records, leadId, { loading = false, loadError = '' } = {}) {
  const id = String(leadId ?? '').trim();
  if (!id) return { status: 'none', lead: null };
  if (loading) return { status: 'waiting', lead: null };

  const lead = (Array.isArray(records) ? records : []).find((record) => String(record?.id) === id) || null;
  if (lead) return { status: 'found', lead };
  if (loadError) return { status: 'waiting', lead: null };
  return { status: 'missing', lead: null };
}
