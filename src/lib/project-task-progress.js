import { taskIsCompleted } from './task-status.js';

export function summarizeProjectTasks(tasks = []) {
  const completed = tasks.filter(taskIsCompleted).length;
  return {
    total: tasks.length,
    completed,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
