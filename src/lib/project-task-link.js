function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

export function findProjectForTask(task, projects = []) {
  if (!task) return null;
  const taskProjectId = String(task.projectId || '').trim();
  if (taskProjectId) return projects.find((item) => String(item.id) === taskProjectId) || null;

  const projectName = normalize(task.project);
  if (!projectName) return null;
  const matches = projects.filter((item) => normalize(item.name) === projectName);
  if (matches.length <= 1) return matches[0] || null;

  const taskClientId = String(task.clientId || '').trim();
  const taskClientName = normalize(task.client);
  const clientMatches = matches.filter((item) => taskClientId
    ? String(item.clientId || '').trim() === taskClientId
    : taskClientName && normalize(item.client) === taskClientName);
  return clientMatches.length === 1 ? clientMatches[0] : null;
}

export function taskBelongsToProject(task, project, projects = []) {
  if (!task || !project) return false;
  const taskProjectId = String(task.projectId || '').trim();
  if (taskProjectId) return taskProjectId === String(project.id);

  const projectName = normalize(project.name);
  if (!projectName || normalize(task.project) !== projectName) return false;
  const sameNameProjects = projects.filter((item) => normalize(item.name) === projectName);
  if (sameNameProjects.length <= 1) return true;

  const taskClientId = String(task.clientId || '').trim();
  const taskClientName = normalize(task.client);
  const matchingProjects = sameNameProjects.filter((item) => {
    if (taskClientId) return String(item.clientId || '').trim() === taskClientId;
    return taskClientName && normalize(item.client) === taskClientName;
  });
  return matchingProjects.length === 1 && String(matchingProjects[0].id) === String(project.id);
}
