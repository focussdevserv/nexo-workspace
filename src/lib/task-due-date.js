const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isTaskDueDate(value) {
  const match = isoDatePattern.exec(String(value || ''));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === match[0];
}

export function taskDueDateInput(task) {
  return isTaskDueDate(task?.due) ? task.due : '';
}

// Free-text deadlines from older records ("30 set") cannot drive recurrence or overdue checks.
export function taskLegacyDueText(task) {
  const due = String(task?.due || '').trim();
  return due && due !== 'A definir' && !isTaskDueDate(due) ? due : '';
}

export function withTaskDueDate(task, value) {
  const due = isTaskDueDate(value) ? value : 'A definir';
  const updated = { ...task, due };
  if (isTaskDueDate(value) && updated.recurrenceAnchorDay) updated.recurrenceAnchorDay = Number(value.slice(8, 10));
  return updated;
}

export function formatTaskDueDate(due, locale = 'pt-BR') {
  if (!isTaskDueDate(due)) return String(due || '').trim() && due !== 'A definir' ? String(due).trim() : 'Sem prazo';
  return new Date(`${due}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
