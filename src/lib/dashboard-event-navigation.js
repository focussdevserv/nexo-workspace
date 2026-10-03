export function dashboardEventNavigationContext(event) {
  if (event?.calendarSource === 'google') {
    const googleEventId = String(event.googleEventId || '').trim();
    if (googleEventId) return { googleEventId, ...(isCalendarDate(event.date) ? { eventDate: event.date } : {}) };
  }
  const eventId = String(event?.id || '').trim();
  return eventId ? { eventId } : null;
}

function isCalendarDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
