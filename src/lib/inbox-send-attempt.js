export function inboxSendAttemptId(attempt, fingerprint, createId) {
  if (attempt.fingerprint !== fingerprint || !attempt.id) {
    attempt.fingerprint = fingerprint;
    attempt.id = createId();
  }
  return attempt.id;
}

export function clearInboxSendAttempt(attempt) {
  attempt.fingerprint = '';
  attempt.id = '';
}
