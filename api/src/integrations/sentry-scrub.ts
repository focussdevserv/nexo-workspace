type SentryRequestLike = Record<string, unknown> & { url?: string };

function stripUrlDetails(value: unknown) {
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch { return value.split(/[?#]/, 1)[0]; }
}

export function scrubSentryEvent<T extends object>(event: T): T {
  const record = event as Record<string, unknown>;
  const { user: _user, ...safeEvent } = record;
  const requestRecord = record.request as SentryRequestLike | undefined;
  const request = requestRecord
    ? (() => {
      const { data: _data, cookies: _cookies, headers: _headers, query_string: _query, ...safeRequest } = requestRecord;
      return { ...safeRequest, ...(safeRequest.url ? { url: stripUrlDetails(safeRequest.url) } : {}) };
    })()
    : undefined;
  const breadcrumbs = Array.isArray(record.breadcrumbs)
    ? record.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== 'object') return crumb;
      const { message: _message, data: _breadcrumbData, ...safeCrumb } = crumb as Record<string, unknown>;
      return safeCrumb;
    })
    : record.breadcrumbs;
  return { ...safeEvent, ...(request ? { request } : {}), ...(breadcrumbs ? { breadcrumbs } : {}) } as T;
}
