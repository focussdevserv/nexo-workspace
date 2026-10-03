import { n8nSetupActionRequired } from './n8n-screen-state.js';

/**
 * Keep the last confirmed n8n snapshot visible when a refresh fails. This keeps
 * transient network errors from erasing usable history while still surfacing
 * the failure so callers can offer an explicit retry.
 */
export function resolveAutomationRefreshState(current, { workflowResult, deliveryResult }) {
  const workflowSucceeded = workflowResult?.status === 'fulfilled';
  const workflowData = workflowSucceeded ? workflowResult.value?.data : null;
  const hasWorkflowData = Array.isArray(workflowData?.workflows) && Array.isArray(workflowData?.executions);
  const deliverySucceeded = deliveryResult?.status === 'fulfilled' && Array.isArray(deliveryResult.value?.data);

  let n8nData = current?.n8nData ?? null;
  let n8nError = workflowResult?.reason?.message || '';
  let n8nSetupRequired = n8nSetupActionRequired(workflowResult?.reason?.code);
  if (hasWorkflowData) {
    n8nData = { ...workflowData, deliveryQueue: workflowData.deliveryQueue || null };
    n8nError = '';
  } else if (workflowSucceeded) {
    n8nError = 'Conecte o n8n em Integrações para consultar workflows e execuções.';
    n8nSetupRequired = true;
  } else {
    n8nError ||= 'Falha ao consultar o n8n.';
  }

  return {
    n8nData,
    n8nError,
    n8nSetupRequired,
    deliveryHistory: deliverySucceeded ? deliveryResult.value.data : (current?.deliveryHistory ?? []),
    deliveryError: deliverySucceeded ? '' : (deliveryResult?.reason?.message || 'Falha ao consultar a fila de entregas.'),
  };
}
