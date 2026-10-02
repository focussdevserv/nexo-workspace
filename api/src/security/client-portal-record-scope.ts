type PortalLinkedRecord = Record<string, unknown>;

/**
 * Workspace records have used three client-reference fields over time.
 * Keep public portal reads and approval writes aligned on the same scope rule.
 */
export function recordBelongsToPortalClient(record: PortalLinkedRecord, clientRecordId: string) {
  const references = [record.clientId, record.workspaceClientId, record.clientRecordId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return references.length > 0 && references.every((value) => value === clientRecordId);
}
