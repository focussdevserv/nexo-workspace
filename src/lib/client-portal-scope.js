/** Keep the admin portal preview aligned with the public API client scope. */
export function recordBelongsToPortalClient(record, clientRecordId) {
  const references = [record?.clientId, record?.workspaceClientId, record?.clientRecordId]
    .filter((value) => typeof value === 'string' && value.length > 0);
  return references.length > 0 && references.every((value) => value === String(clientRecordId));
}
