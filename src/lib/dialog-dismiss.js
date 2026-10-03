export function handleDialogEscape(event, { busy = false, onClose } = {}) {
  if (event.key !== 'Escape' || busy || typeof onClose !== 'function') return false;
  event.preventDefault();
  onClose();
  return true;
}

export function restoreDialogFocus(target) {
  if (!target?.isConnected || typeof target.focus !== 'function') return false;
  try {
    target.focus();
    return true;
  } catch {
    return false;
  }
}
