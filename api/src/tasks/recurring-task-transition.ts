const completedStatuses = new Set(['concluida', 'concluido', 'completed', 'done']);
const openStatuses = new Set(['a fazer', 'pendente', 'todo', 'open']);
const occurrenceResetFields = new Set([
  'id', 'createdAt', 'updatedAt', 'due', 'state', 'status', 'recurrenceId', 'recurrenceSequence',
  'recurrenceAnchorDay', 'checklist', 'comments', 'attachment', 'dependency',
]);
const occurrenceGeneratedFields = new Set(['recurrenceId', 'recurrenceSequence', 'recurrenceAnchorDay']);

function normalized(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function isTaskCompleted(data: Record<string, unknown>) {
  return [data.status, data.state].some((value) => completedStatuses.has(normalized(value)));
}

export function taskRecurrenceIdentity(id: string, data: Record<string, unknown>) {
  const recurrence = normalized(data.recurrence);
  if (!['diaria', 'semanal', 'mensal'].includes(recurrence)) return null;
  const recurrenceId = String(data.recurrenceId || id);
  const sequence = Math.max(1, Number(data.recurrenceSequence) || 1);
  return { recurrenceId, sequence, nextSequence: sequence + 1 };
}

export function validNextTaskOccurrence(id: string, current: Record<string, unknown>, patch: Record<string, unknown>, next: Record<string, unknown>) {
  const updatedCurrent = { ...current, ...patch };
  const identity = taskRecurrenceIdentity(id, updatedCurrent);
  if (!identity || !isTaskCompleted({ ...current, ...patch })) return false;
  const nextIdentity = taskRecurrenceIdentity(id, next);
  if (!nextIdentity || nextIdentity.recurrenceId !== identity.recurrenceId || nextIdentity.sequence !== identity.nextSequence) return false;
  if (normalized(next.recurrence) !== normalized((patch.recurrence ?? current.recurrence))) return false;
  if (String(next.title ?? '') !== String(patch.title ?? current.title ?? '')) return false;
  if (!openStatuses.has(normalized(next.status)) || !openStatuses.has(normalized(next.state))) return false;
  // A new occurrence carries the task's associations and work details forward. Only
  // occurrence-specific state is reset; accepting different client/project data here
  // can silently move the recurring work into another record on completion.
  for (const [key, value] of Object.entries(updatedCurrent)) {
    if (occurrenceResetFields.has(key)) continue;
    if (JSON.stringify(next[key]) !== JSON.stringify(value)) return false;
  }
  for (const key of Object.keys(next)) {
    if (occurrenceResetFields.has(key) || occurrenceGeneratedFields.has(key)) continue;
    if (!Object.hasOwn(updatedCurrent, key)) return false;
  }
  const previousDue = String(patch.due ?? current.due ?? '');
  const nextDue = String(next.due ?? '');
  if ((previousDue && !/^\d{4}-\d{2}-\d{2}$/.test(previousDue)) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDue) || (previousDue && nextDue <= previousDue)) return false;
  const parsed = new Date(`${nextDue}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === nextDue;
}

export function taskOccurrenceMatches(existing: Record<string, unknown>, proposed: Record<string, unknown>) {
  if (String(existing.recurrenceId || '') !== String(proposed.recurrenceId || '')
    || Number(existing.recurrenceSequence) !== Number(proposed.recurrenceSequence)
    || normalized(existing.recurrence) !== normalized(proposed.recurrence)
    || String(existing.title ?? '') !== String(proposed.title ?? '')
    || String(existing.due ?? '') !== String(proposed.due ?? '')
    || !openStatuses.has(normalized(existing.status))
    || !openStatuses.has(normalized(existing.state))) return false;

  // An idempotent retry must return the same occurrence payload, including links,
  // priority, checklist, description, and assignee, rather than accepting a partial
  // identity match and showing stale data in the UI.
  const keys = new Set([...Object.keys(existing), ...Object.keys(proposed)]);
  keys.delete('id');
  keys.delete('createdAt');
  keys.delete('updatedAt');
  for (const key of keys) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(proposed[key])) return false;
  }
  return true;
}
