export type SiteCheckFailureReason = 'host_not_public' | 'invalid_url' | 'check_failed';

/** Prevents scheduled failures from leaving a stale successful status on the asset. */
export function siteCheckFailureData(
  previous: Record<string, unknown>,
  checkedAt: string,
  reason: SiteCheckFailureReason,
): Record<string, unknown> {
  return {
    ...previous,
    health: 'Offline',
    status: 'Offline',
    httpStatus: null,
    latencyMs: null,
    sslExpiresAt: null,
    checkedAt,
    lastCheckErrorCode: reason,
  };
}
