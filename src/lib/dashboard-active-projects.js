const activeProjectStatuses = new Set(['em andamento', 'in progress', 'in_progress', 'active', 'ativo']);

export function filterDashboardActiveProjects(projects = []) {
  return projects.filter((project) => {
    const status = String(project?.status || project?.state || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    return activeProjectStatuses.has(status);
  });
}
