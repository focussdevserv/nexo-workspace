export function resolveProposalServices(services = [], serviceIds = [], legacyServiceId = '') {
  const requestedIds = [...new Set((Array.isArray(serviceIds) ? serviceIds : []).map(String).filter(Boolean))];
  if (!requestedIds.length && legacyServiceId) requestedIds.push(String(legacyServiceId));
  const byId = new Map(services.map((service) => [String(service.id), service]));
  return requestedIds.map((id) => byId.get(id)).filter(Boolean);
}

export function summarizeProposalServices(services = []) {
  const names = [...new Set(services.map((service) => String(service.name || '').trim()).filter(Boolean))];
  const tasks = [...new Set(services.flatMap((service) => Array.isArray(service.templateTasks) ? service.templateTasks : []).map((task) => String(task || '').trim()).filter(Boolean))];
  const responsible = [...new Set(services.map((service) => String(service.responsible || '').trim()).filter(Boolean))];
  return {
    names,
    label: names.join(' + '),
    proposalScope: services.map((service) => String(service.proposalTemplate || service.description || '').trim()).filter(Boolean).join('\n\n'),
    contractScope: services.map((service) => String(service.contractTemplate || service.description || '').trim()).filter(Boolean).join('\n\n'),
    tasks,
    responsible,
  };
}
