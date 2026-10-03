export function resolveAgendaNavigationEvent(events, eventId, eventsLoaded, {
  googleEventId = '',
  googleEvents = [],
  googleEventsLoaded = eventsLoaded,
} = {}) {
  if (!eventsLoaded) return { event: null, consume: false };
  const workspaceEvents = Array.isArray(events) ? events : [];
  if (eventId) {
    const event = workspaceEvents.find((item) => String(item.id) === String(eventId)) || null;
    return { event, consume: true };
  }
  if (!googleEventId) return { event: null, consume: false };
  const linkedWorkspaceEvent = workspaceEvents.find((item) => String(item.googleEventId || '') === String(googleEventId)) || null;
  if (linkedWorkspaceEvent) return { event: linkedWorkspaceEvent, consume: true };
  if (!googleEventsLoaded) return { event: null, consume: false };
  const externalEvent = (Array.isArray(googleEvents) ? googleEvents : []).find((item) => String(item.googleEventId || '') === String(googleEventId)) || null;
  return { event: externalEvent, consume: true };
}
