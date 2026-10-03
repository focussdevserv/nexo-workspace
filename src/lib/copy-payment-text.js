/** Copy payment instructions on secure and older/insecure browser contexts. */
export async function copyPaymentText(value, { clipboard = globalThis.navigator?.clipboard, document = globalThis.document } = {}) {
  const text = String(value ?? '');
  if (!text) return false;

  try {
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permissions can reject even when the API exists; try the DOM fallback.
  }

  if (!document?.body || typeof document.execCommand !== 'function') return false;
  const activeElement = document.activeElement;
  const selection = document.getSelection?.();
  const selectedRanges = [];
  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) selectedRanges.push(selection.getRangeAt(index));
  }

  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.setAttribute('aria-hidden', 'true');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.append(field);

  let copied = false;
  try {
    field.focus();
    field.select();
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    field.remove();
    activeElement?.focus?.({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      selectedRanges.forEach((range) => selection.addRange(range));
    }
  }
  return copied;
}
