export function inboxSendAttemptId(attempt, fingerprint, createId) {
  if (attempt.fingerprint !== fingerprint || !attempt.id) {
    attempt.fingerprint = fingerprint;
    attempt.id = createId();
  }
  return attempt.id;
}

export async function persistedInboxSendAttemptId(attempt, fingerprint, createId, storage) {
  if (attempt.fingerprint === fingerprint && attempt.id) return attempt.id;
  let storageKey = '';
  let id = '';
  let persistentStorage = storage;
  try {
    persistentStorage ||= globalThis.localStorage;
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(fingerprint));
    const hash = [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
    storageKey = `focusshub:gmail-send-attempt:${hash}`;
    id = persistentStorage?.getItem(storageKey) || '';
    if (!id) {
      id = createId();
      persistentStorage?.setItem(storageKey, id);
    }
  } catch {
    id = createId();
  }
  attempt.fingerprint = fingerprint;
  attempt.id = id;
  attempt.storageKey = storageKey;
  attempt.storage = persistentStorage;
  return id;
}

export function clearInboxSendAttempt(attempt) {
  try { if (attempt.storageKey) attempt.storage?.removeItem(attempt.storageKey); } catch { /* Storage may be unavailable or disabled. */ }
  attempt.fingerprint = '';
  attempt.id = '';
  attempt.storageKey = '';
  attempt.storage = null;
}
