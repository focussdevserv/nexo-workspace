export function moveLeadById(leads, leadId, stage) {
  const targetId = String(leadId ?? '');
  if (!targetId || !stage || !leads.some((lead) => String(lead.id) === targetId)) return leads;
  return leads.map((lead) => String(lead.id) === targetId ? { ...lead, stage } : lead);
}
