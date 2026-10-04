export const defaultPipelineStages = [
  'Novo lead', 'Contato realizado', 'Reunião agendada', 'Diagnóstico',
  'Proposta enviada', 'Negociação', 'Fechado', 'Perdido',
] as const;

export const pipelineStageLimit = 12;
const inactivePipelineStageLimit = 100;
const terminalStages = new Set(['Fechado', 'Perdido']);

export function validatePipelineStageConfig(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'A configuração das etapas é inválida.';
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !['key', 'stages', 'inactiveStages'].includes(key)) || data.key !== 'pipeline-stages' || !Array.isArray(data.stages) || !Array.isArray(data.inactiveStages)) return 'Informe listas válidas de etapas ativas e inativas.';
  if (data.stages.length < 3 || data.stages.length > pipelineStageLimit || data.inactiveStages.length > inactivePipelineStageLimit) return `Mantenha entre 3 e ${pipelineStageLimit} etapas ativas e até ${inactivePipelineStageLimit} arquivadas.`;
  const active = data.stages;
  const inactive = data.inactiveStages;
  const all = [...active, ...inactive];
  if (!all.every((stage) => typeof stage === 'string' && stage.trim() === stage && stage.length >= 2 && stage.length <= 48 && !/[<>\u0000-\u001f]/.test(stage))) return 'Cada etapa deve ter entre 2 e 48 caracteres válidos.';
  const keys = all.map((stage) => (stage as string).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR'));
  if (new Set(keys).size !== keys.length) return 'As etapas precisam ter nomes únicos.';
  if (terminalStages.size !== [...active].filter((stage) => terminalStages.has(String(stage))).length || active.at(-2) !== 'Fechado' || active.at(-1) !== 'Perdido') return 'As etapas Fechado e Perdido precisam permanecer ativas no final do Pipeline.';
  return null;
}

export function pipelineStageConfigAllows(config: unknown, stage: unknown, currentStage?: unknown): boolean {
  if (stage == null || stage === '') return true;
  const value = String(stage);
  if (currentStage != null && String(currentStage) === value) return true;
  const active = config && typeof config === 'object' && Array.isArray((config as Record<string, unknown>).stages)
    ? (config as { stages: unknown[] }).stages : [...defaultPipelineStages];
  return active.includes(value);
}
