type SiteSchedule = { id: string; data: unknown };

/** Select only monitor records linked to the site being removed. */
export function siteAssetScheduleIds(assetId: string, schedules: SiteSchedule[]): string[] {
  if (!assetId) return [];
  return schedules
    .filter((schedule) => {
      const data = schedule.data && typeof schedule.data === 'object' && !Array.isArray(schedule.data)
        ? schedule.data as Record<string, unknown>
        : {};
      return String(data.siteAssetId ?? '') === assetId;
    })
    .map(({ id }) => id);
}
