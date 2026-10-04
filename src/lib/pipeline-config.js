export const DEFAULT_PIPELINE_STAGES = Object.freeze([
  'Novo lead', 'Contato realizado', 'Reunião agendada', 'Diagnóstico',
  'Proposta enviada', 'Negociação', 'Fechado', 'Perdido',
]);

const normalizeStage = (value) => String(value ?? '').trim();

export function resolvePipelineStageConfig(record) {
  const stages = Array.isArray(record?.stages) ? record.stages.map(normalizeStage).filter(Boolean) : [];
  const inactiveStages = Array.isArray(record?.inactiveStages) ? record.inactiveStages.map(normalizeStage).filter(Boolean) : [];
  if (!stages.length) return { stages: [...DEFAULT_PIPELINE_STAGES], inactiveStages: [] };
  return { stages, inactiveStages };
}

export function pipelineColumnsForRecords(config, leads = []) {
  const activeStages = [...config.stages];
  const activeKeys = new Set(activeStages);
  const legacyStages = [...new Set(leads.map((lead) => normalizeStage(lead.stage) || DEFAULT_PIPELINE_STAGES[0]))]
    .filter((stage) => !activeKeys.has(stage));
  return [...activeStages, ...legacyStages];
}

export function nextPipelineStageConfig(current, nextStages, nextInactiveStages = current.inactiveStages) {
  const normalizeKey = (stage) => normalizeStage(stage).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const active = [...new Set(nextStages.map(normalizeStage).filter(Boolean))];
  const inactive = [...new Set(nextInactiveStages.map(normalizeStage).filter(Boolean))]
    .filter((stage) => !active.some((activeStage) => normalizeKey(activeStage) === normalizeKey(stage)));
  return { key: 'pipeline-stages', stages: active, inactiveStages: inactive };
}
