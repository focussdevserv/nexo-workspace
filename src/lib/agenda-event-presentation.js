export function isAgendaAllDayEvent(event) {
  return event?.allDay === true || !event?.time;
}
