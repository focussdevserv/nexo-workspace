function normalizeStage(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function commercialStageTone(stage = '') {
  const value = normalizeStage(stage);
  if (['perdido', 'recusada', 'cancelado', 'cancelada', 'expirada', 'vencida'].includes(value)) return 'red';
  if (value.includes('novo')) return 'blue';
  if (value.includes('qualificacao')) return 'purple';
  if (value.includes('reuniao')) return 'amber';
  if (['rascunho', 'inativo', 'aguardando assinatura'].includes(value)) return 'gray';
  return 'green';
}
