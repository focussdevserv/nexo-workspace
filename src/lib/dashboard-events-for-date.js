import { calendarDateKeyForValue } from './calendar-preferences.js';
import { isAgendaAllDayEvent } from './agenda-event-presentation.js';
import { isAgendaEventVisibleOnDate } from './agenda-event-visibility.js';

export function dashboardEventsForDate(events, dateKey, timeZone) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => {
    if (!event || typeof event !== 'object') return false;
    const eventDate = event.date || calendarDateKeyForValue(event.startsAt, timeZone);
    if (isAgendaAllDayEvent(event) && event.date) return isAgendaEventVisibleOnDate(event, dateKey);
    return calendarDateKeyForValue(eventDate, timeZone) === dateKey;
  });
}
