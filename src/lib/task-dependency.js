const completedStatuses = new Set(['concluida', 'concluido', 'completed', 'done']);

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function taskDependencyBlocker(tasks, task) {
  const dependencyId = String(task?.dependency || '').trim();
  if (!dependencyId || dependencyId === String(task?.id)) return null;
  const dependency = (Array.isArray(tasks) ? tasks : []).find((item) => String(item.id) === dependencyId);
  if (!dependency) return null;
  const completed = [dependency.status, dependency.state].some((value) => completedStatuses.has(normalized(value)));
  return completed ? null : dependency;
}

export function taskDependencyWouldCreateCycle(tasks, taskId, dependencyId) {
  const currentId = String(taskId || '').trim();
  let nextId = String(dependencyId || '').trim();
  if (!currentId || !nextId) return false;
  const byId = new Map((Array.isArray(tasks) ? tasks : []).map((task) => [String(task.id), task]));
  const visited = new Set();
  while (nextId) {
    if (nextId === currentId) return true;
    if (visited.has(nextId)) return false;
    visited.add(nextId);
    nextId = String(byId.get(nextId)?.dependency || '').trim();
  }
  return false;
}

export function taskDependencyBlockMessage(dependency) {
  const title = String(dependency?.title || '').trim() || 'a tarefa anterior';
  return `Conclua “${title}” antes de finalizar esta tarefa.`;
}
