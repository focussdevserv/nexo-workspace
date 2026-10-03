export function goalSourceErrorState(error) {
  const code = String(error?.code || '').trim().toLowerCase();
  const status = Number(error?.status ?? error?.details?.status);
  if (status === 403 || ['forbidden', 'permission_denied', 'insufficient_permissions'].includes(code)) return 'restricted';
  if (/\b(forbidden|permission denied|sem permiss[aã]o|sem acesso|n[aã]o tem permiss[aã]o)\b/i.test(error?.message || '')) return 'restricted';
  return 'failed';
}
