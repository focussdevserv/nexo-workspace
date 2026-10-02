import { taskIsCompleted } from './task-status.js';

function normalizedStatus(task) {
  return String(task?.state || task?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const pendingStatuses = new Set(['pendente', 'a fazer', 'aberta', 'novo']);

export function filterDashboardTasks(tasks, filter) {
  if (filter === 'Em andamento') return tasks.filter((task) => !taskIsCompleted(task) && normalizedStatus(task) === 'em andamento');
  if (filter === 'Pendente') return tasks.filter((task) => !taskIsCompleted(task) && pendingStatuses.has(normalizedStatus(task)));
  if (filter === 'Concluída') return tasks.filter(taskIsCompleted);
  return tasks;
}
