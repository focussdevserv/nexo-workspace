import { deleteAgendaEvent } from './agenda-event-delete.js';

export function agendaEventDeletionIds(event, events, scope = 'occurrence') {
  const eventId = String(event?.id || '');
  if (!eventId) return [];
  const seriesId = String(event?.recurrenceId || '');
  if (scope !== 'series' || !seriesId) return [eventId];
  return (Array.isArray(events) ? events : [])
    .filter((item) => String(item?.recurrenceId || '') === seriesId)
    .map((item) => String(item.id));
}

export function confirmAgendaEventDeletion(event, scope, confirm, required = true) {
  if (!required) return true;
  const message = scope === 'series' && event?.recurrenceId
    ? 'Excluir todos os compromissos desta serie?'
    : 'Excluir este evento da agenda?';
  return confirm(message) !== false;
}

export async function deleteAgendaEventSeries({ events, removeLocal, deleteGoogle }) {
  const results = [];
  for (const event of Array.isArray(events) ? events : []) {
    const result = await deleteAgendaEvent({ event, removeLocal, deleteGoogle });
    results.push({ event, ...result });
    if (!result.ok && result.reason === 'local_delete_failed') break;
  }
  return {
    results,
    removed: results.filter((result) => result.ok).length,
    remotePending: results.filter((result) => result.remotePending).length,
    failed: results.some((result) => !result.ok),
  };
}
