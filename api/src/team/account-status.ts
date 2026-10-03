export type TeamInviteActivity = {
  action: string;
  payload?: unknown;
  createdAt?: string | Date | number;
};

export type TeamAccessStatus = 'active' | 'invite_pending' | 'invite_expired' | 'suspended' | 'inactive';

export function teamAccessStatus(input: { active: boolean; latestInviteActivity?: TeamInviteActivity | null; now?: Date | number }) {
  if (input.active) return { status: 'active' as TeamAccessStatus, inviteExpiresAt: null as string | null };

  const latest = input.latestInviteActivity;
  if (latest?.action === 'deactivated') return { status: 'suspended' as TeamAccessStatus, inviteExpiresAt: null as string | null };
  if (latest?.action !== 'invited' && latest?.action !== 'invite_renewed') {
    return { status: 'inactive' as TeamAccessStatus, inviteExpiresAt: null as string | null };
  }

  const payload = latest.payload && typeof latest.payload === 'object' ? latest.payload as Record<string, unknown> : {};
  const rawExpiry = payload.inviteExpiresAt;
  const savedExpiry = typeof rawExpiry === 'string' ? Date.parse(rawExpiry) : Number.NaN;
  const createdAt = latest.createdAt instanceof Date ? latest.createdAt.getTime()
    : typeof latest.createdAt === 'number' ? latest.createdAt
      : typeof latest.createdAt === 'string' ? Date.parse(latest.createdAt) : Number.NaN;
  const expiry = Number.isFinite(savedExpiry) ? savedExpiry : Number.isFinite(createdAt) ? createdAt + 48 * 60 * 60 * 1000 : Number.NaN;
  const inviteExpiresAt = Number.isFinite(expiry) ? new Date(expiry).toISOString() : null;
  const now = input.now instanceof Date ? input.now.getTime() : typeof input.now === 'number' ? input.now : Date.now();
  return {
    status: Number.isFinite(expiry) && expiry <= now ? 'invite_expired' as TeamAccessStatus : 'invite_pending' as TeamAccessStatus,
    inviteExpiresAt,
  };
}
