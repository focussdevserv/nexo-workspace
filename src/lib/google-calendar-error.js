export function googleCalendarErrorAction(code) {
  if (['google_reauthorization_required', 'google_calendar_scope_required', 'google_authorization_required'].includes(String(code || ''))) return 'reauthorize';
  if (code === 'integration_disconnected' || code === 'google_oauth_client_misconfigured') return 'open_integrations';
  return 'retry';
}
