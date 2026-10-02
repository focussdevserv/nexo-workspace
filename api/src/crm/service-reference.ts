/** Remove catalog IDs from editable sales records while retaining their historical labels. */
export function detachCatalogServiceReference<T extends Record<string, unknown>>(record: T, serviceId: string): T {
  let changed = false;
  const next: Record<string, unknown> = { ...record };
  if (String(record.serviceId ?? '') === serviceId) {
    delete next.serviceId;
    changed = true;
  }
  if (Array.isArray(record.serviceIds)) {
    const serviceIds = record.serviceIds.filter((id) => String(id) !== serviceId);
    if (serviceIds.length !== record.serviceIds.length) {
      next.serviceIds = serviceIds;
      changed = true;
    }
  }
  return (changed ? next : record) as T;
}
