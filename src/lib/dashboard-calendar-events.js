import { calendarDateKeyInTimeZone } from './calendar-preferences.js';

export function dashboardCalendarDayQuery(instant = new Date(), timeZone = 'America/Sao_Paulo') {
  const day = calendarDateKeyInTimeZone(instant, timeZone);
  return new URLSearchParams({ from: day, to: day, timeZone });
}

export function mergeDashboardCalendarEvents(workspaceEvents = [], googleEvents = []) {
  const workspace = Array.isArray(workspaceEvents) ? workspaceEvents.filter(isRecord) : [];
  const external = Array.isArray(googleEvents) ? googleEvents.filter(isRecord) : [];
  const linkedGoogleIds = new Set(workspace.map((event) => normalizeId(event.googleEventId)).filter(Boolean));
  const seenGoogleIds = new Set(linkedGoogleIds);
  const unlinkedExternal = external.filter((event) => {
    const id = normalizeId(event.googleEventId);
    if (!id || seenGoogleIds.has(id)) return false;
    seenGoogleIds.add(id);
    return true;
  });
  return [...workspace, ...unlinkedExternal];
}

function normalizeId(value) {
  return String(value ?? '').trim();
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
