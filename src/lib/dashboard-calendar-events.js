import { calendarDateKeyInTimeZone } from './calendar-preferences.js';

export function dashboardCalendarDayQuery(instant = new Date(), timeZone = 'America/Sao_Paulo') {
  const day = calendarDateKeyInTimeZone(instant, timeZone);
  return new URLSearchParams({ from: day, to: day, timeZone });
}

export function mergeDashboardCalendarEvents(workspaceEvents = [], googleEvents = []) {
  const workspace = Array.isArray(workspaceEvents) ? workspaceEvents.filter(isRecord) : [];
  const external = Array.isArray(googleEvents) ? googleEvents.filter(isRecord) : [];
  const linkedGoogleIds = new Set(workspace.map((event) => normalizeId(event.googleEventId)).filter(Boolean).map((id) => `google:${id}`));
  const seenGoogleIds = new Set(linkedGoogleIds);
  const seenExternalIds = new Set();
  const unlinkedExternal = external.filter((event) => {
    const providerId = normalizeId(event.googleEventId);
    const stableId = normalizeId(event.id);
    // Calendar records normally include googleEventId. Keep a usable event with
    // only its own ID too, while still removing duplicates from repeated pages.
    const id = providerId ? `google:${providerId}` : stableId ? `event:${stableId}` : '';
    if (!id || seenGoogleIds.has(id) || seenExternalIds.has(id)) return false;
    seenExternalIds.add(id);
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
