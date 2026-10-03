/** Remote workflow mutations require a fresh, successful n8n snapshot. */
export function canMutateN8nWorkflows({ data, loading = false, error = '' } = {}) {
  return Boolean(data && !loading && !error);
}

export function n8nMutationUnavailableMessage({ loading = false, error = '' } = {}) {
  if (loading) return 'Aguarde o status atual do n8n antes de alterar workflows.';
  if (error) return 'Atualize o status do n8n e confirme a conexão antes de alterar workflows.';
  return 'Conecte o n8n e confirme a conexão antes de alterar workflows.';
}
