import { calendarDateKeyInTimeZone, calendarTimeInTimeZone } from './calendar-preferences.js';
import { isAgendaAllDayEvent } from './agenda-event-presentation.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isAgendaEventUpcoming(event, { now = new Date(), timeZone, fromDateKey = '' } = {}) {
  const eventDate = String(event?.date || '');
  if (!datePattern.test(eventDate)) return false;

  const today = calendarDateKeyInTimeZone(now, timeZone);
  const thresholdDate = fromDateKey > today ? fromDateKey : today;
  if (eventDate < thresholdDate) return false;
  if (eventDate > today || isAgendaAllDayEvent(event)) return true;

  const eventTime = String(event?.time || '');
  if (!timePattern.test(eventTime)) return false;
  return eventTime > calendarTimeInTimeZone(now, timeZone);
}

export function upcomingAgendaEvents(events, { now = new Date(), timeZone, fromDateKey = '' } = {}) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => isAgendaEventUpcoming(event, { now, timeZone, fromDateKey }))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.time || '').localeCompare(String(right.time || '')));
}

export function nextAgendaEventTime(events, dateKey, { now = new Date(), timeZone } = {}) {
  const today = calendarDateKeyInTimeZone(now, timeZone);
  if (!datePattern.test(String(dateKey || '')) || dateKey < today) return '';

  return (Array.isArray(events) ? events : [])
    .filter((event) => String(event?.date || '') === dateKey
      && !isAgendaAllDayEvent(event)
      && timePattern.test(String(event?.time || ''))
      && isAgendaEventUpcoming(event, { now, timeZone }))
    .sort((left, right) => String(left.time).localeCompare(String(right.time)))[0]?.time || '';
}
