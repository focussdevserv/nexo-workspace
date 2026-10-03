/** Keep the last usable invitation link until a replacement is confirmed. */
export function resolveTeamInviteLink(current, event) {
  if (event?.type !== 'created' || typeof event.url !== 'string' || !event.url.trim()) return current;
  return {
    url: event.url.trim(),
    recipient: String(event.recipient ?? '').trim().toLowerCase(),
  };
}
