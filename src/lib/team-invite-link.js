/** Keep the last usable invitation link until a replacement is confirmed. */
export function resolveTeamInviteLink(current, event) {
  if (event?.type !== 'created' || typeof event.url !== 'string' || !event.url.trim()) return current;
  return {
    url: event.url.trim(),
    recipient: String(event.recipient ?? '').trim().toLowerCase(),
  };
}

/** Hide a displayed link once the matching invite is accepted, expired, or revoked. */
export function reconcileTeamInviteLink(current, accounts) {
  if (!current?.url || !current.recipient || !Array.isArray(accounts)) return current;
  const recipient = String(current.recipient).trim().toLowerCase();
  const account = accounts.find((item) => String(item?.email || '').trim().toLowerCase() === recipient);
  if (!account) return current;
  if (account.active || ['invite_expired', 'suspended'].includes(account.accessStatus)) return { url: '', recipient: '' };
  return current;
}
