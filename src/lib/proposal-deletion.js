import { proposalAcceptanceState } from './proposal-acceptance-state.js';

export function proposalDeletionBlockReason(proposal, { contracts = [], projects = [] } = {}) {
  if (!proposal) return '';
  const proposalId = String(proposal.id ?? '');
  const linkedContract = contracts.some((contract) => String(contract.sourceProposalId ?? '') === proposalId);
  const linkedProject = projects.some((project) => String(project.sourceProposalId ?? '') === proposalId);
  const approved = proposalAcceptanceState(proposal.status) === 'accepted';
  if (approved || linkedContract || linkedProject) {
    return 'Esta proposta já foi aprovada ou originou registros de entrega. Mantenha-a para preservar o histórico do contrato, projeto e tarefas.';
  }
  return '';
}
