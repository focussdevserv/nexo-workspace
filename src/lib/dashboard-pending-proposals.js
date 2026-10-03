import { proposalAcceptanceState } from './proposal-acceptance-state.js';

/** Keep Meu Dia's pending proposal count aligned with the CRM proposal lifecycle. */
export function dashboardPendingProposalCount(proposals = []) {
  if (!Array.isArray(proposals)) return 0;
  return proposals.filter((proposal) => proposal && typeof proposal === 'object' && !Array.isArray(proposal) && proposalAcceptanceState(proposal.status) === 'pending').length;
}
