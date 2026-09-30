export type ProposalAcceptanceDisposition = 'create_bundle' | 'return_existing' | 'reject_closed';

export function proposalAcceptanceDisposition(status: unknown): ProposalAcceptanceDisposition {
  const normalized = String(status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (normalized === 'aprovada') return 'return_existing';
  if (normalized === 'recusada' || normalized === 'expirada') return 'reject_closed';
  return 'create_bundle';
}
