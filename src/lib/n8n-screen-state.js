const setupActionErrorCodes = new Set([
  'n8n_not_configured',
  'integration_not_configured',
  'integration_disconnected',
]);

export function n8nSetupActionRequired(errorCode) {
  return setupActionErrorCodes.has(errorCode);
}
