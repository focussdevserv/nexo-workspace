import { isAgendaAllDayEvent } from './agenda-event-presentation.js';

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isAgendaEventVisibleOnDate(event, dateKey) {
  const startDate = String(event?.date || '');
  if (!dateKeyPattern.test(startDate) || !dateKeyPattern.test(String(dateKey || ''))) return false;
  if (startDate === dateKey) return true;
  if (startDate > dateKey) return false;
  const endDate = String(event?.endDate || '');
  if (isAgendaAllDayEvent(event)) {
    // Calendar provider end dates for all-day events are exclusive.
    return dateKeyPattern.test(endDate) && endDate > dateKey;
  }

  // Timed events ending after midnight continue into their end date. An end
  // time of 00:00 is exclusive, so it does not occupy any time on that date.
  const endTime = String(event?.end || '');
  return dateKeyPattern.test(endDate)
    && endDate === dateKey
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    && endTime !== '00:00';
}

export function isAgendaEventVisibleInPeriod(event, startDate, endDate) {
  const eventDate = String(event?.date || '');
  if (!dateKeyPattern.test(eventDate) || !dateKeyPattern.test(String(startDate || '')) || !dateKeyPattern.test(String(endDate || ''))) return false;
  return (eventDate >= startDate && eventDate <= endDate)
    || (eventDate < startDate && isAgendaEventVisibleOnDate(event, startDate));
}

export function agendaTimedEventSegmentOnDate(event, dateKey, { firstHour = 7, lastHour = 21 } = {}) {
  if (!event || isAgendaAllDayEvent(event) || !isAgendaEventVisibleOnDate(event, dateKey)) return null;
  const startDate = String(event.date || '');
  const startMatch = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(event.time || ''));
  const endMatch = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(event.end || ''));
  if (!startMatch) return null;
  const minutes = (value) => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins; };
  const dayStart = firstHour * 60;
  const dayEnd = lastHour * 60;
  const continuesFromPreviousDay = startDate < dateKey;
  const rawStart = continuesFromPreviousDay ? dayStart : minutes(event.time);
  let rawEnd = endMatch ? minutes(event.end) : Math.min(minutes(event.time) + 60, 24 * 60);
  if (!continuesFromPreviousDay && endMatch && rawEnd <= rawStart) rawEnd += 24 * 60;
  if (continuesFromPreviousDay && rawEnd <= dayStart) return null;
  const visibleStart = Math.max(dayStart, rawStart);
  const visibleEnd = Math.min(dayEnd, rawEnd);
  if (visibleEnd <= visibleStart) return null;
  return {
    startMinutes: visibleStart,
    endMinutes: visibleEnd,
    continuesFromPreviousDay,
    continuesAfterGrid: rawEnd > dayEnd,
  };
}
