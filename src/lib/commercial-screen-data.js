const textFieldsByResource = Object.freeze({
  leads: ['name', 'company', 'service', 'source', 'stage', 'value', 'date', 'email', 'phone', 'owner', 'nextAction', 'closeDate', 'notes', 'initials', 'tone'],
  clients: ['name', 'person', 'email', 'phone', 'website', 'address', 'segment', 'status', 'since', 'projects', 'value', 'notes', 'clientType', 'legalName', 'document', 'cpf', 'cnpj', 'companyDocument', 'initials', 'tone'],
  companies: ['name', 'segment', 'city', 'size', 'people', 'status', 'email', 'phone', 'website', 'address', 'notes', 'initials', 'tone'],
  contacts: ['name', 'role', 'company', 'email', 'phone', 'last', 'status', 'initials', 'tone'],
  proposals: ['name', 'title', 'code', 'client', 'email', 'value', 'status', 'date', 'scope', 'deadline', 'paymentTerms', 'service', 'tone'],
  contracts: ['name', 'title', 'code', 'client', 'email', 'value', 'status', 'renewal', 'renewalDate', 'progress', 'service', 'deadline', 'paymentTerms', 'scope', 'tone'],
  services: ['name', 'category', 'catalogGroup', 'description', 'price', 'cadence', 'duration', 'color', 'responsible', 'proposalTemplate', 'contractTemplate'],
});

function safeDisplayText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/**
 * Keep malformed rows and nested objects from becoming invalid React children
 * in commercial tables/cards. The returned copies are for display only; callers
 * must continue persisting the original workspace records.
 */
export function normalizeCommercialScreenRows(resource, rows) {
  if (!Array.isArray(rows)) return [];
  const fields = textFieldsByResource[resource] || [];
  return rows
    .filter((row) => row !== null && typeof row === 'object' && !Array.isArray(row))
    .map((row) => {
      const safeRow = { ...row };
      for (const field of fields) {
        if (field in safeRow) safeRow[field] = safeDisplayText(safeRow[field]);
      }
      return safeRow;
    });
}
