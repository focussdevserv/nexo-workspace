export function resolveAgendaNavigationEvent(events, eventId, eventsLoaded) {
  if (!eventId || !eventsLoaded) return { event: null, consume: false };
  const event = (Array.isArray(events) ? events : []).find((item) => String(item.id) === String(eventId)) || null;
  return { event, consume: true };
}
