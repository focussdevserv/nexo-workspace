const completedStatuses = new Set(['concluida', 'concluido', 'completed', 'done']);

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function nextDate(date, recurrence, anchorDay) {
  const value = new Date(`${date}T12:00:00`);
  if (recurrence === 'Diaria') value.setDate(value.getDate() + 1);
  else if (recurrence === 'Semanal') value.setDate(value.getDate() + 7);
  else {
    value.setDate(1);
    value.setMonth(value.getMonth() + 1);
    const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    value.setDate(Math.min(anchorDay, lastDay));
  }
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function nextRecurringTask(tasks, task, now = new Date()) {
  const recurrence = ['Diaria', 'Semanal', 'Mensal'].find((item) => normalized(item) === normalized(task.recurrence));
  if (!recurrence) return null;
  const recurrenceId = String(task.recurrenceId || task.id);
  const sequence = Math.max(1, Number(task.recurrenceSequence) || 1);
  if (tasks.some((item) => String(item.recurrenceId || item.id) === recurrenceId && Number(item.recurrenceSequence || 1) === sequence + 1)) return null;

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const hasDueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(task.due || ''));
  let due = hasDueDate ? task.due : today;
  const anchorDay = Number(task.recurrenceAnchorDay) || Number((hasDueDate ? task.due : today).slice(8, 10));
  do { due = nextDate(due, recurrence, anchorDay); } while (due <= today);
  return {
    ...task,
    id: globalThis.crypto?.randomUUID?.() || `recurring-task-${Date.now()}-${sequence + 1}`,
    due,
    state: 'A fazer',
    status: 'A fazer',
    recurrence,
    recurrenceId,
    recurrenceSequence: sequence + 1,
    recurrenceAnchorDay: anchorDay,
    checklist: (task.checklist || []).map((item) => typeof item === 'string' ? { title: item, done: false } : { ...item, done: false }),
    comments: [],
    attachment: '',
    dependency: '',
    createdAt: now.toISOString(),
  };
}

export function completeTaskOccurrence(tasks, taskId, now = new Date()) {
  const task = tasks.find((item) => String(item.id) === String(taskId));
  if (!task) return { tasks, occurrence: null };
  const reopening = [task.status, task.state].some((value) => completedStatuses.has(normalized(value)));
  const nextStatus = reopening ? 'A fazer' : 'Concluída';
  const updated = tasks.map((item) => String(item.id) === String(taskId) ? { ...item, state: nextStatus, status: nextStatus } : item);
  const occurrence = reopening ? null : nextRecurringTask(updated, task, now);
  return { tasks: occurrence ? [...updated, occurrence] : updated, occurrence };
}
