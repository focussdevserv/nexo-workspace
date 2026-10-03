import { belongsToClient } from '../data/client-link.js';

/** Keep profile details tied to one client when records contain legacy ID aliases. */
export function belongsToClientProfileRecord(record, client, legacyValue) {
  if (!record || !client) return false;

  // Keep this list aligned with the aliases accepted by the API's record
  // scoping rules. Imported rows can use snake_case or company/customer names;
  // an explicit foreign ID must never fall through to a matching display name.
  const explicitClientIds = [
    record.clientId, record.workspaceClientId, record.clientRecordId,
    record.client_id, record.workspace_client_id, record.client_record_id,
    record.companyId, record.workspaceCompanyId, record.companyRecordId,
    record.company_id, record.workspace_company_id, record.company_record_id,
    record.customerId, record.workspaceCustomerId, record.customerRecordId,
    record.customer_id, record.workspace_customer_id, record.customer_record_id,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(String);

  if (explicitClientIds.length) {
    return explicitClientIds.every((id) => id === String(client.id));
  }

  return belongsToClient(record, client, legacyValue);
}
