export function submitHoursEditOnce(lock, persist) {
  if (!lock?.run || typeof persist !== 'function') return Promise.resolve({ ok: false, invalid: true });
  return lock.run(persist);
}
