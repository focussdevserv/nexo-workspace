type SiteAsset = { id: string; data: Record<string, unknown> };
type MonitorSchedule = { id: string; data: unknown };

function objectData(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Build one canonical schedule payload and identify duplicate schedule rows to archive. */
export function planSiteMonitorConfiguration(
  asset: SiteAsset,
  schedules: MonitorSchedule[],
  enabled: boolean,
  intervalMinutes: number,
  nextCheckAt: string | null,
) {
  const canonical = schedules.find((schedule) => objectData(schedule.data).enabled === true) ?? schedules[0];
  const data = {
    ...objectData(canonical?.data),
    siteAssetId: asset.id,
    name: String(asset.data.name ?? ''),
    clientId: asset.data.clientId ?? null,
    intervalMinutes,
    enabled,
    nextCheckAt: enabled ? nextCheckAt : null,
  };
  return {
    canonicalId: canonical?.id ?? null,
    data,
    duplicateIds: schedules.filter((schedule) => schedule.id !== canonical?.id).map((schedule) => schedule.id),
  };
}
