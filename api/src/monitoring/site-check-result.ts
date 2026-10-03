import type { SiteCheckResult } from './site-check.js';

/** Normalize the currently saved address the same way as a monitor request. */
export function siteCheckTargetFor(data: Record<string, unknown>): string {
  const raw = String(data.url ?? data.domain ?? data.name ?? '').trim();
  if (!raw) return '';
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return `invalid:${raw}`;
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return `invalid:${raw}`;
    if (url.port && !['80', '443'].includes(url.port)) return `invalid:${raw}`;
    return url.toString();
  } catch {
    return `invalid:${raw}`;
  }
}

/** Do not attach a result to an asset whose URL changed while the network check ran. */
export function siteCheckResultMatchesAsset(data: Record<string, unknown>, result: SiteCheckResult): boolean {
  return siteCheckTargetFor(data) === result.url;
}

/** Merge probe fields into the latest record so edits made during a probe survive. */
export function siteCheckResultData(previous: Record<string, unknown>, result: SiteCheckResult): Record<string, unknown> {
  const { lastCheckErrorCode: _ignored, ...current } = previous;
  return {
    ...current,
    url: result.url,
    health: result.status,
    status: result.status,
    httpStatus: result.httpStatus,
    latencyMs: result.latencyMs,
    sslExpiresAt: result.sslExpiresAt,
    checkedAt: result.checkedAt,
  };
}
