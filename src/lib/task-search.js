import { matchesWorkSearch } from './work-search.js';

export function taskMatchesSearch(task, query) {
  if (!task || typeof task !== 'object') return false;
  return matchesWorkSearch([
    task.title, task.project, task.client, task.assignee, task.due, task.priority,
    task.status, task.state, task.recurrence, task.description, task.detail,
  ], query);
}
