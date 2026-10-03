/** Keep the last successful Google event set when a refresh fails. */
export function resolveGoogleCalendarSyncEvents(currentEvents, result, error = null) {
  if (error) return Array.isArray(currentEvents) ? currentEvents : [];
  return Array.isArray(result?.data) ? result.data : [];
}
