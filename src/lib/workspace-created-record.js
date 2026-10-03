export function resolveCreatedWorkspaceRecord(saveResult, temporaryId) {
  if (!saveResult || !Array.isArray(saveResult.records)) return null;
  const persistedId = saveResult.createdIds?.[String(temporaryId)] || temporaryId;
  return saveResult.records.find((record) => String(record.id) === String(persistedId)) || null;
}
