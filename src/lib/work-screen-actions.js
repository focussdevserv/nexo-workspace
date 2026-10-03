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
