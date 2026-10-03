const sessionKeyPrefix = 'focusshub.client-portal.session.';
const sessionDurationMs = 8 * 60 * 60 * 1000;

export function getClientPortalSessionStorage(windowRef = globalThis.window) {
  try { return windowRef?.sessionStorage || null; }
  catch { return null; }
}

export function readClientPortalSession(storage, slug, now = Date.now()) {
  if (!storage || !slug) return '';
  const key = `${sessionKeyPrefix}${slug}`;
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    if (typeof value?.token === 'string' && value.token && Number(value.expiresAt) > now) return value.token;
    storage.removeItem(key);
  } catch {
    try { storage.removeItem(key); } catch { /* Session storage may be disabled by the browser. */ }
  }
  return '';
}

export function writeClientPortalSession(storage, slug, token, now = Date.now()) {
  if (!storage || !slug) return false;
  const key = `${sessionKeyPrefix}${slug}`;
  try {
    if (typeof token !== 'string' || !token) {
      storage.removeItem(key);
      return true;
    }
    storage.setItem(key, JSON.stringify({ token, expiresAt: now + sessionDurationMs }));
    return true;
  } catch {
    return false;
  }
}

export function clearClientPortalSession(storage, slug) {
  return writeClientPortalSession(storage, slug, '');
}
