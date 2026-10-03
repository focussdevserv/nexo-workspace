const collectionByScreen = {
  agenda: 'events',
  tarefas: 'tasks',
  projetos: 'projects',
  arquivos: 'files',
  aprovacoes: 'approvals',
};

export const projectStatusFilters = Object.freeze([
  'Todos', 'A fazer', 'Em andamento', 'Aguardando cliente', 'Concluído', 'Arquivado',
]);

const normalizeProjectStatus = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

const completedProjectStatuses = new Set(['concluido', 'concluida', 'completed', 'complete', 'done']);
const archivedProjectStatuses = new Set(['arquivado', 'archived']);

export function projectStatusCategory(project) {
  const status = normalizeProjectStatus(project?.status || project?.state);
  if (completedProjectStatuses.has(status)) return 'concluido';
  if (archivedProjectStatuses.has(status)) return 'arquivado';
  if (['a fazer', 'pendente', 'pending', 'todo'].includes(status)) return 'a fazer';
  if (['em andamento', 'in progress', 'in-progress', 'active'].includes(status)) return 'em andamento';
  if (['aguardando cliente', 'waiting client', 'waiting for client', 'on hold'].includes(status)) return 'aguardando cliente';
  return status;
}

export function projectMatchesStatusFilter(project, selected) {
  const category = projectStatusCategory(project);
  if (selected === 'Todos') return category !== 'arquivado';
  return category === projectStatusCategory({ status: selected });
}

export function canCreateWorkRecord(screen, collections = {}) {
  const collection = collectionByScreen[screen];
  if (!collection) return true;
  const state = collections[collection];
  return state?.loaded === true && !state.error;
}

export function canSelectWorkspaceFileUpload({
  canWrite,
  uploading,
  loaded,
  error,
  scopeRequired,
  hasScopeLink,
}) {
  return Boolean(canWrite && !uploading && loaded && !error && (!scopeRequired || hasScopeLink));
}

export function shouldShowProjectKanbanEmpty({ visibleCount, loaded, error }) {
  return Number(visibleCount) === 0 && loaded === true && !error;
}
