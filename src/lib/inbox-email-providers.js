const inboxEmailProviderNames = new Set(['Google Workspace', 'Hostinger E-mail']);

/** Return only mail providers that have a usable account linked to this workspace. */
export function availableInboxEmailProviders(statusRows) {
  if (!Array.isArray(statusRows)) return [];
  return statusRows.filter((item) =>
    inboxEmailProviderNames.has(item?.name) && item.enabled === true && typeof item.accountEmail === 'string' && item.accountEmail.trim(),
  );
}
