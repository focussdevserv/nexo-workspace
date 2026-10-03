import { calendarTimeInTimeZone } from './calendar-preferences.js';

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function minutesOfDay(value) {
  if (!timePattern.test(String(value || ''))) return -1;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function eventTime(event, timeZone) {
  if (event?.allDay === true || (!event?.time && !event?.startsAt)) return '';
  if (timePattern.test(String(event?.time || ''))) return event.time;
  if (event?.startsAt) {
    const instant = new Date(event.startsAt);
    if (!Number.isNaN(instant.getTime())) return calendarTimeInTimeZone(instant, timeZone);
  }
  return '';
}

/**
 * Selects the event to show in the Meu Dia schedule strip.
 * `events` should contain only events for the current calendar day.
 */
export function selectDashboardHighlightedEvent(events, {
  now = new Date(),
  timeZone,
  defaultDurationMinutes = 60,
} = {}) {
  const list = Array.isArray(events) ? events : [];
  const currentMinutes = minutesOfDay(calendarTimeInTimeZone(now, timeZone));
  if (currentMinutes < 0) return { event: null, status: 'idle' };

  const scheduled = list
    .map((event, index) => ({ event, index, time: eventTime(event, timeZone), start: minutesOfDay(eventTime(event, timeZone)) }))
    .filter(({ event }) => event && typeof event === 'object')
    .sort((left, right) => {
      if (left.start < 0) return right.start < 0 ? left.index - right.index : 1;
      if (right.start < 0) return -1;
      return left.start - right.start || left.index - right.index;
    });

  const active = scheduled.find(({ event, start }) => {
    if (start < 0) return false;
    const duration = Number(event.durationMinutes ?? event.duration) || defaultDurationMinutes;
    return currentMinutes >= start && currentMinutes < start + duration;
  });
  if (active) return { event: active.event, status: 'active' };

  const upcoming = scheduled.find(({ start }) => start > currentMinutes);
  if (upcoming) return { event: upcoming.event, status: 'upcoming' };

  const allDay = scheduled.find(({ event }) => event.allDay === true);
  if (allDay) return { event: allDay.event, status: 'all-day' };

  const unscheduled = scheduled.find(({ start }) => start < 0);
  if (unscheduled) return { event: unscheduled.event, status: 'unscheduled' };

  return { event: null, status: 'idle' };
}
