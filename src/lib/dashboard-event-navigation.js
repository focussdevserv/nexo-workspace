export function dashboardEventNavigationContext(event) {
  const eventId = String(event?.id || '').trim();
  return eventId ? { eventId } : null;
}
