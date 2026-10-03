/** Render the linked model from the provider's current workflow response. */
export function automationN8nLinkState(item, { workflows = [], loading = false, error = '', localDemo = false } = {}) {
  if (!item?.n8nWorkflowId) {
    return { state: 'local', label: localDemo ? 'Modelo simulado' : 'Modelo local', active: false };
  }

  if (loading) return { state: 'unknown', label: 'Atualizando estado no n8n', active: false };
  if (error) return { state: 'unknown', label: 'Estado do n8n indisponível', active: false };

  const workflow = workflows.find((entry) => String(entry.id) === String(item.n8nWorkflowId));
  if (workflow) {
    return workflow.active
      ? { state: 'published', label: 'Publicado no n8n', active: true }
      : { state: 'draft', label: 'Rascunho no n8n', active: false };
  }

  return { state: 'unlisted', label: 'Workflow ainda não carregado', active: false };
}
