export function submitApprovalComment({ locks, approvalId, text, save }) {
  const comment = String(text || '').trim();
  if (!comment || typeof save !== 'function' || !locks?.run) {
    return Promise.resolve({ ok: false, invalid: true });
  }

  return locks.run(approvalId, () => save(comment));
}
