import { taskIsCompleted } from './task-status.js';
import { taskDependencyBlocker } from './task-dependency.js';

export function dashboardTaskCompletionBlocker(tasks, task) {
  if (!task || taskIsCompleted(task)) return null;
  return taskDependencyBlocker(tasks, task);
}
