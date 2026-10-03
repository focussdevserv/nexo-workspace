import { isAgendaAllDayEvent } from './agenda-event-presentation.js';

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isAgendaEventVisibleOnDate(event, dateKey) {
  const startDate = String(event?.date || '');
  if (!dateKeyPattern.test(startDate) || !dateKeyPattern.test(String(dateKey || ''))) return false;
  if (startDate === dateKey) return true;
  if (!isAgendaAllDayEvent(event) || startDate > dateKey) return false;

  // Calendar provider end dates for all-day events are exclusive.
  const endDate = String(event?.endDate || '');
  return dateKeyPattern.test(endDate) && endDate > dateKey;
}

export function isAgendaEventVisibleInPeriod(event, startDate, endDate) {
  const eventDate = String(event?.date || '');
  if (!dateKeyPattern.test(eventDate) || !dateKeyPattern.test(String(startDate || '')) || !dateKeyPattern.test(String(endDate || ''))) return false;
  return (eventDate >= startDate && eventDate <= endDate)
    || (isAgendaAllDayEvent(event) && eventDate < startDate && isAgendaEventVisibleOnDate(event, startDate));
}
