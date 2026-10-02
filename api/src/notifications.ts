const supportedActions = new Set([
  'created', 'updated', 'provider_updated', 'received', 'accepted',
  'created_from_accepted_proposal', 'signature_requested', 'signature_status_synced',
]);

const titlePairs: Record<string, [string, string]> = {
  inbox: ['Nova mensagem no WhatsApp', 'Nova mensagem no WhatsApp'],
  leads: ['Novo lead recebido', 'Lead atualizado'],
  clients: ['Cliente cadastrado', 'Cliente atualizado'],
  client: ['Cliente cadastrado', 'Cliente atualizado'],
  proposals: ['Nova proposta', 'Proposta atualizada'],
  contracts: ['Contrato criado', 'Contrato atualizado'],
  projects: ['Projeto criado', 'Projeto atualizado'],
  tasks: ['Nova tarefa', 'Tarefa atualizada'],
  events: ['Reunião agendada', 'Reunião atualizada'],
  tickets: ['Novo ticket de suporte', 'Ticket de suporte atualizado'],
  approvals: ['Nova aprovação', 'Aprovação atualizada'],
  billing_order: ['Cobrança criada', 'Cobrança atualizada'],
  billing_subscription: ['Assinatura criada', 'Assinatura atualizada'],
};

export function normalizeBrowserNotificationPreferences(value: unknown) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const clock = (candidate: unknown, fallback: string) => typeof candidate === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(candidate) ? candidate : fallback;
  return {
    taskDue: source.taskDue !== false,
    overdue: source.overdue !== false,
    newLead: source.newLead !== false,
    proposal: source.proposal !== false,
    payment: source.payment !== false,
    browser: source.browser === true,
    quietHours: source.quietHours === true,
    quietStart: clock(source.quietStart, '20:00'),
    quietEnd: clock(source.quietEnd, '08:00'),
  };
}

export function notificationAccessPath(entityType: string) {
  if (entityType === 'billing_order') return '/api/billing/orders';
  if (entityType === 'billing_subscription') return '/api/billing/subscriptions';
  if (entityType === 'client') return '/api/clients';
  if (titlePairs[entityType]) return `/api/workspace/${entityType}`;
  return null;
}

export function resolveActivityNotificationTitle(entityType: string, action: string): string | null {
  if (!supportedActions.has(action)) return null;
  if (entityType === 'proposals' && action === 'accepted') return 'Proposta aceita';
  if (entityType === 'contracts' && action === 'created_from_accepted_proposal') return 'Contrato criado após proposta aceita';
  if (entityType === 'contracts' && action === 'signature_requested') return 'Contrato enviado para assinatura';
  if (entityType === 'contracts' && action === 'signature_status_synced') return 'Status de assinatura atualizado';
  const pair = titlePairs[entityType];
  if (!pair) return null;
  if (entityType === 'billing_order' && action === 'provider_updated') return 'Pagamento atualizado';
  return pair[action === 'created' ? 0 : 1];
}
