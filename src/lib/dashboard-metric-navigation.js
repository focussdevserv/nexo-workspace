const destinations = Object.freeze({
  projects: { page: 'Projetos' },
  tasks: { page: 'Tarefas' },
  events: { page: 'Agenda' },
  leads: { page: 'Leads' },
  receivables: { page: 'Cobranças' },
  overdue: { page: 'Cobranças', context: { filter: 'overdue' } },
});

export function dashboardMetricNavigation(metric) {
  const destination = destinations[metric];
  return destination ? { ...destination, ...(destination.context ? { context: { ...destination.context } } : {}) } : null;
}
