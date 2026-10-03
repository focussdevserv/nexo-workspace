export async function copyTextToClipboard(text, environment = {}) {
  const value = String(text ?? '');
  if (!value) return false;

  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(value);
      return true;
    } catch {
      // Continue with the selection-based fallback for restricted contexts.
    }
  }

  const documentRef = environment.document ?? globalThis.document;
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') return false;

  const previousFocus = documentRef.activeElement;
  const field = documentRef.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  Object.assign(field.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
  documentRef.body.appendChild(field);
  try {
    field.focus();
    field.select();
    return Boolean(documentRef.execCommand('copy'));
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.();
  }
}
