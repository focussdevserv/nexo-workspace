const normalizeStatus = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const inactiveStatuses = new Set([
  'concluido', 'concluida', 'completed', 'complete', 'done',
  'arquivado', 'archived', 'cancelado', 'cancelada', 'cancelled', 'canceled',
  'pausado', 'pausada', 'paused', 'suspended', 'suspenso', 'suspensa',
]);

export function isWorkProjectActive(project = {}) {
  return ![project.status, project.state]
    .filter((value) => value != null && String(value).trim() !== '')
    .some((value) => inactiveStatuses.has(normalizeStatus(value)));
}

export function countActiveWorkProjects(projects = []) {
  return (Array.isArray(projects) ? projects : []).filter(isWorkProjectActive).length;
}
