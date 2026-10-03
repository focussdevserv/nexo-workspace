const normalizeStatus = (status) => String(status ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

export function proposalAcceptanceState(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'aprovada' || normalized === 'approved' || normalized === 'accepted') return 'accepted';
  if (normalized === 'recusada' || normalized === 'expirada' || normalized === 'rejected' || normalized === 'expired') return 'closed';
  return 'pending';
}
