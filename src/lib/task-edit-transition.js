import { nextRecurringTask } from './task-recurrence.js';
import { taskIsCompleted } from './task-status.js';
import { taskDependencyBlocker, taskDependencyBlockMessage, taskDependencyWouldCreateCycle } from './task-dependency.js';

export function prepareTaskDetailsUpdate(tasks, taskId, patch, now = new Date()) {
  const current = (Array.isArray(tasks) ? tasks : []).find((task) => String(task.id) === String(taskId));
  if (!current) return { ok: false, error: { message: 'Esta tarefa não está mais disponível. Atualize a lista e tente novamente.' } };

  const candidate = tasks.map((task) => {
    if (String(task.id) !== String(taskId)) return task;
    const updated = { ...task, ...patch };
    if (Object.hasOwn(patch, 'status') || Object.hasOwn(patch, 'state')) {
      const status = Object.hasOwn(patch, 'status') ? patch.status : patch.state;
      updated.status = status;
      updated.state = status;
    }
    return updated;
  });
  const nextTask = candidate.find((task) => String(task.id) === String(taskId));
  if (taskDependencyWouldCreateCycle(candidate, taskId, nextTask.dependency)) {
    return { ok: false, error: { message: 'Esta dependência criaria um ciclo. Escolha uma tarefa que não dependa desta tarefa.' } };
  }

  const completing = !taskIsCompleted(current) && taskIsCompleted(nextTask);
  if (completing) {
    const blocker = taskDependencyBlocker(tasks, nextTask);
    if (blocker) return { ok: false, error: { message: taskDependencyBlockMessage(blocker) } };
    const occurrence = nextRecurringTask(candidate, nextTask, now);
    return { ok: true, tasks: occurrence ? [...candidate, occurrence] : candidate, occurrence };
  }

  return { ok: true, tasks: candidate, occurrence: null };
}
