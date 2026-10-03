const reauthorizationCodes = new Set([
  'google_authorization_required',
  'google_reauthorization_required',
  'google_gmail_scope_required',
]);

export function googleEmailErrorAction(code) {
  if (reauthorizationCodes.has(String(code || ''))) return 'reauthorize';
  if (code === 'integration_not_configured' || code === 'integration_disconnected') return 'configure';
  return 'retry';
}
