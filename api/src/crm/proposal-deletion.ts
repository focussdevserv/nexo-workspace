import { proposalAcceptanceDisposition } from '../integrations/proposal-acceptance.js';

export function proposalDeletionBlockReason(status: unknown, hasLinkedDeliveryRecords: boolean) {
  if (hasLinkedDeliveryRecords || proposalAcceptanceDisposition(status) === 'return_existing') {
    return 'Esta proposta já foi aprovada ou originou registros de entrega. Mantenha-a para preservar o histórico do contrato, projeto e tarefas.';
  }
  return '';
}
