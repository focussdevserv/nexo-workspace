import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PIPELINE_STAGES, nextPipelineStageConfig, pipelineColumnsForRecords, resolvePipelineStageConfig } from './pipeline-config.js';

test('uses retrocompatible defaults until a workspace config exists', () => {
  assert.deepEqual(resolvePipelineStageConfig(undefined), { stages: [...DEFAULT_PIPELINE_STAGES], inactiveStages: [] });
});

test('shows data in removed/legacy stages instead of hiding the lead', () => {
  const config = { stages: ['Novo lead', 'Fechado', 'Perdido'], inactiveStages: ['Negociação'] };
  assert.deepEqual(pipelineColumnsForRecords(config, [{ stage: 'Negociação' }, { stage: 'negociacao' }, { stage: 'Antiga etapa' }]), ['Novo lead', 'Fechado', 'Perdido', 'Negociação', 'negociacao', 'Antiga etapa']);
});

test('normalizes drafts to one unique active/inactive membership', () => {
  const result = nextPipelineStageConfig({ inactiveStages: ['Novo Lead'] }, ['Novo lead', 'Fechado', 'Perdido', 'Novo lead'], ['Novo Lead', 'Revisão']);
  assert.deepEqual(result, { key: 'pipeline-stages', stages: ['Novo lead', 'Fechado', 'Perdido'], inactiveStages: ['Revisão'] });
});
