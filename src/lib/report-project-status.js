const normalizeStatus = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const completedStatuses = new Set(['concluido', 'concluida', 'completed', 'complete', 'done']);
const inactiveStatuses = new Set([
  ...completedStatuses,
  'arquivado', 'archived', 'cancelado', 'cancelada', 'cancelled', 'canceled',
  'pausado', 'pausada', 'paused', 'suspended', 'suspenso', 'suspensa',
]);

export function isReportProjectCompleted(project = {}) {
  return [project.status, project.state].some((value) => completedStatuses.has(normalizeStatus(value)));
}

export function isReportProjectActive(project = {}) {
  return ![project.status, project.state].some((value) => inactiveStatuses.has(normalizeStatus(value)));
}
