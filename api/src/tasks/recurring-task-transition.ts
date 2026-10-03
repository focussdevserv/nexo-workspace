const completedStatuses = new Set(['concluida', 'concluido', 'completed', 'done']);
const openStatuses = new Set(['a fazer', 'pendente', 'todo', 'open']);

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
  const identity = taskRecurrenceIdentity(id, { ...current, ...patch });
  if (!identity || !isTaskCompleted({ ...current, ...patch })) return false;
  const nextIdentity = taskRecurrenceIdentity(id, next);
  if (!nextIdentity || nextIdentity.recurrenceId !== identity.recurrenceId || nextIdentity.sequence !== identity.nextSequence) return false;
  if (normalized(next.recurrence) !== normalized((patch.recurrence ?? current.recurrence))) return false;
  if (String(next.title ?? '') !== String(patch.title ?? current.title ?? '')) return false;
  if (!openStatuses.has(normalized(next.status)) || !openStatuses.has(normalized(next.state))) return false;
  const previousDue = String(patch.due ?? current.due ?? '');
  const nextDue = String(next.due ?? '');
  if ((previousDue && !/^\d{4}-\d{2}-\d{2}$/.test(previousDue)) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDue) || (previousDue && nextDue <= previousDue)) return false;
  const parsed = new Date(`${nextDue}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === nextDue;
}

export function taskOccurrenceMatches(existing: Record<string, unknown>, proposed: Record<string, unknown>) {
  return String(existing.recurrenceId || '') === String(proposed.recurrenceId || '')
    && Number(existing.recurrenceSequence) === Number(proposed.recurrenceSequence)
    && normalized(existing.recurrence) === normalized(proposed.recurrence)
    && String(existing.title ?? '') === String(proposed.title ?? '')
    && String(existing.due ?? '') === String(proposed.due ?? '')
    && openStatuses.has(normalized(existing.status))
    && openStatuses.has(normalized(existing.state));
}
