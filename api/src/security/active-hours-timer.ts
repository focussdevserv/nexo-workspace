export type HoursTimerRecord = { id?: unknown; status?: unknown };

/** A workspace timer is a singleton action across tabs and devices. */
export function findOtherRunningHoursTimer(records: HoursTimerRecord[], currentId?: string) {
  return records.find((record) => record.status === 'running' && String(record.id ?? '') !== String(currentId ?? '')) ?? null;
}
