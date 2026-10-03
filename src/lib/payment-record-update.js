/** Replace the locally displayed record with a confirmed server response. */
export function replacePaymentRecord(records, updated) {
  if (!Array.isArray(records) || !updated || updated.id == null) return records;
  const updatedId = String(updated.id);
  return records.map((record) => String(record?.id ?? '') === updatedId ? updated : record);
}
