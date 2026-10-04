export const clientProfileRelatedPaths = {
  projects: '/api/workspace/projects',
  tasks: '/api/workspace/tasks',
  contracts: '/api/workspace/contracts',
  inbox: '/api/workspace/inbox',
  files: '/api/workspace/files',
  tickets: '/api/workspace/tickets',
  approvals: '/api/workspace/approvals',
  events: '/api/workspace/events',
  revenues: '/api/workspace/revenues',
  expenses: '/api/workspace/expenses',
  settings: '/api/workspace/settings',
  billing: '/api/billing/orders',
  subscriptions: '/api/billing/subscriptions',
};

const sectionResources = {
  projects: ['projects', 'tasks'],
  history: ['events', 'projects', 'tasks', 'tickets', 'approvals', 'contracts', 'files', 'billing', 'subscriptions', 'revenues', 'expenses'],
};

const resourceLabels = {
  projects: 'projetos',
  tasks: 'tarefas',
  contracts: 'contratos',
  inbox: 'conversas',
  files: 'arquivos',
  tickets: 'tickets',
  approvals: 'aprovações',
  events: 'eventos',
  revenues: 'receitas',
  expenses: 'despesas',
  settings: 'preferências',
  billing: 'cobranças',
  subscriptions: 'assinaturas',
};

export function clientProfileFailedResources(section, errors = {}) {
  return (sectionResources[section] || []).filter((resource) => Boolean(errors?.[resource]));
}

export function clientProfileResourceLabels(resources = []) {
  return (Array.isArray(resources) ? resources : [])
    .map((resource) => resourceLabels[resource] || String(resource))
    .join(', ');
}

// An empty list only means "nothing recorded" when every source loaded.
export function clientProfileSectionIsEmpty({ section, errors = {}, loading = false, count = 0 }) {
  return !loading && count === 0 && clientProfileFailedResources(section, errors).length === 0;
}

export function clientProfileActiveProjectsLabel({ count = 0, errors = {}, loading = false }) {
  if (errors?.projects) return 'Indisponível';
  if (loading) return '...';
  return String(count);
}

export function applyClientProfileRetryResults(related = {}, errors = {}, results = []) {
  const nextRelated = { ...related };
  const nextErrors = { ...errors };
  for (const result of Array.isArray(results) ? results : []) {
    if (!result?.resource) continue;
    if (result.error) {
      nextErrors[result.resource] = result.error;
    } else {
      nextRelated[result.resource] = Array.isArray(result.rows) ? result.rows : [];
      delete nextErrors[result.resource];
    }
  }
  return { related: nextRelated, errors: nextErrors };
}
