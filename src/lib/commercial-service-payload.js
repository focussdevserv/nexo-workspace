export function commercialServicePayload({ common, draft, tone }) {
  return {
    ...common,
    category: draft.detail?.trim() || 'Geral',
    description: draft.description?.trim() || 'Serviço cadastrado pela equipe.',
    price: draft.value?.trim() ? `A partir de R$ ${draft.value.trim()}` : 'A combinar',
    cadence: draft.cadence?.trim() || 'Projeto fechado',
    color: tone,
  };
}
