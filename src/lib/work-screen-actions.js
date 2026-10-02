const collectionByScreen = {
  agenda: 'events',
  tarefas: 'tasks',
  projetos: 'projects',
  arquivos: 'files',
  aprovacoes: 'approvals',
};

export function canCreateWorkRecord(screen, collections = {}) {
  const collection = collectionByScreen[screen];
  if (!collection) return true;
  const state = collections[collection];
  return state?.loaded === true && !state.error;
}
