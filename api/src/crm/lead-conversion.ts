export type LeadConversionSource = {
  id: string;
  name?: unknown;
  title?: unknown;
  company?: unknown;
  email?: unknown;
  phone?: unknown;
  source?: unknown;
  service?: unknown;
  value?: unknown;
  notes?: unknown;
};

export function buildClientFromLead(lead: LeadConversionSource, now = new Date()) {
  const contactName = String(lead.name ?? lead.title ?? '').trim();
  const companyName = String(lead.company ?? '').trim();
  const name = companyName && companyName.toLocaleLowerCase('pt-BR') !== 'empresa nao informada' ? companyName : contactName;
  return {
    name,
    person: contactName,
    email: String(lead.email ?? '').trim().toLocaleLowerCase('en-US'),
    phone: String(lead.phone ?? '').trim(),
    source: String(lead.source ?? 'Manual'),
    segment: String(lead.service ?? 'A definir'),
    services: lead.service ? [String(lead.service)] : [],
    projects: '0 projetos',
    value: lead.value ?? 'A definir',
    status: 'Ativo',
    since: now.toISOString().slice(0, 10),
    notes: String(lead.notes ?? ''),
    leadId: lead.id,
  };
}
