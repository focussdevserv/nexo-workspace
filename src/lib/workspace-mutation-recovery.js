export async function recoverWorkspaceRecordsAfterFailure(fetchRecords, resource, fallbackRecords) {
  try {
    const records = await fetchRecords(`/api/workspace/${resource}`);
    if (!Array.isArray(records)) throw new Error('A resposta de recupera\u00e7\u00e3o n\u00e3o cont\u00e9m uma lista de registros.');
    return { records, recovered: true };
  } catch (recoveryError) {
    return { records: fallbackRecords, recovered: false, recoveryError };
  }
}
