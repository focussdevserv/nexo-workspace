type GoogleCalendarEvent = {
  id?: unknown;
  status?: unknown;
  summary?: unknown;
  description?: unknown;
  start?: { dateTime?: unknown; date?: unknown };
  end?: { dateTime?: unknown; date?: unknown };
  attendees?: Array<{ email?: unknown }>;
  hangoutLink?: unknown;
  htmlLink?: unknown;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: unknown; uri?: unknown }> };
};

/**
 * Google Calendar PATCH leaves omitted fields unchanged. Keep attendees in the
 * payload even when the list is empty so a user can remove every guest.
 */
export function googleCalendarAttendeesPayload(attendees: string[]) {
  return { attendees: attendees.map((email) => ({ email })) };
}

function dateAndTime(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const dateKey = `${get('year')}-${get('month')}-${get('day')}`;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  return { date: dateKey, time };
}

export function mapGoogleCalendarEvents(input: unknown, timeZone = 'America/Sao_Paulo') {
  if (!Array.isArray(input)) return [];
  return input.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const event = entry as GoogleCalendarEvent;
    const id = typeof event.id === 'string' ? event.id : '';
    if (!id || event.status === 'cancelled') return [];
    const allDay = typeof event.start?.date === 'string';
    const start = allDay ? { date: event.start!.date as string, time: '00:00' } : dateAndTime(String(event.start?.dateTime || ''), timeZone);
    const end = allDay ? { date: event.end?.date || event.start!.date as string, time: '23:59' } : dateAndTime(String(event.end?.dateTime || ''), timeZone);
    if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start.date)) return [];
    const meetUrl = typeof event.hangoutLink === 'string'
      ? event.hangoutLink
      : event.conferenceData?.entryPoints?.find((point) => point.entryPointType === 'video' && typeof point.uri === 'string')?.uri;
    return [{
      id: `google-${id}`,
      googleEventId: id,
      googleMeetUrl: meetUrl || '',
      googleHtmlLink: typeof event.htmlLink === 'string' ? event.htmlLink : '',
      date: start.date,
      time: start.time,
      end: end.date === start.date ? end.time : '23:59',
      endDate: end.date,
      allDay,
      title: typeof event.summary === 'string' && event.summary.trim() ? event.summary.trim() : 'Evento sem título',
      detail: typeof event.description === 'string' ? event.description : '',
      people: Array.isArray(event.attendees) ? event.attendees.flatMap((person) => typeof person?.email === 'string' ? [person.email] : []).join(', ') : '',
      color: 'violet',
      calendarSyncStatus: 'connected',
      calendarSource: 'google',
    }];
  });
}
