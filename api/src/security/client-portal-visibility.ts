const portalSections = ['project', 'tasks', 'contracts', 'payments', 'approvals'] as const;
export type ClientPortalSection = (typeof portalSections)[number];

/** Portal sections are visible by default for legacy client records. */
export function isClientPortalSectionVisible(client: Record<string, unknown>, section: ClientPortalSection) {
  const visibility = client.portalVisibility;
  if (!visibility || typeof visibility !== 'object' || Array.isArray(visibility)) return true;
  const value = (visibility as Record<string, unknown>)[section];
  return value !== false;
}

export function clientPortalVisibleSections(client: Record<string, unknown>) {
  return Object.fromEntries(portalSections.map((section) => [section, isClientPortalSectionVisible(client, section)])) as Record<ClientPortalSection, boolean>;
}
