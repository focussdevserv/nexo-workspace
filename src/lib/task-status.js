const completedStatuses = new Set(['concluida', 'concluido', 'completed', 'done']);

function normalizeTaskStatus(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function taskIsCompleted(task) {
  return [task?.state, task?.status].some((value) => completedStatuses.has(normalizeTaskStatus(value)));
}

export function taskStatusForEdit(task) {
  if (taskIsCompleted(task)) return 'Concluída';
  const status = task?.status || task?.state || 'A fazer';
  const normalized = normalizeTaskStatus(status);
  if (['a fazer', 'pendente', 'pending', 'todo', 'aberta', 'novo'].includes(normalized)) return 'A fazer';
  if (['em andamento', 'in progress'].includes(normalized)) return 'Em andamento';
  return String(status).trim() || 'A fazer';
}

export function withTaskStatus(task, status) {
  return { ...task, state: status, status };
}

export function taskMatchesStatus(task, selected) {
  if (selected === 'Todas') return true;
  if (normalizeTaskStatus(selected) === 'concluida') return taskIsCompleted(task);
  const status = normalizeTaskStatus(task?.status || task?.state);
  const filter = normalizeTaskStatus(selected);
  if (filter === 'a fazer') return ['a fazer', 'pendente', 'pending', 'todo'].includes(status);
  return status === filter;
}
