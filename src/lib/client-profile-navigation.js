export function clientProfileNavigationContext(client, context = null) {
  return {
    ...(context && typeof context === 'object' ? context : {}),
    clientId: client?.id,
    clientName: client?.name || client?.title || '',
    clientEmail: client?.email || '',
    clientPhone: client?.phone || '',
  };
}
