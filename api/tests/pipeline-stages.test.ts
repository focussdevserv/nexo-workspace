import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPipelineStages, pipelineStageConfigAllows, validatePipelineStageConfig } from '../src/crm/pipeline-stages.js';

const valid = { key: 'pipeline-stages', stages: [...defaultPipelineStages], inactiveStages: [] };

test('accepts default and custom ordered stages while keeping terminal stages active', () => {
  assert.equal(validatePipelineStageConfig(valid), null);
  assert.equal(validatePipelineStageConfig({ ...valid, stages: ['Qualificação', ...valid.stages] }), null);
});

test('rejects missing terminal stages, duplicate labels, markup, and oversized stage lists', () => {
  assert.match(validatePipelineStageConfig({ ...valid, stages: valid.stages.filter((stage) => stage !== 'Perdido') }) || '', /Fechado e Perdido/);
  assert.match(validatePipelineStageConfig({ ...valid, stages: [...valid.stages.slice(0, -2), 'negociacao', ...valid.stages.slice(-2)] }) || '', /únicos/);
  assert.match(validatePipelineStageConfig({ ...valid, stages: [...valid.stages, '<script>'] }) || '', /caracteres válidos/);
  assert.match(validatePipelineStageConfig({ ...valid, stages: [...valid.stages, 'A', 'B', 'C', 'D', 'E'] }) || '', /3 e 12/);
});

test('new and moved leads must use active stages; unchanged legacy stages remain editable', () => {
  const config = { stages: ['Novo lead', 'Fechado', 'Perdido'] };
  assert.equal(pipelineStageConfigAllows(config, 'Novo lead'), true);
  assert.equal(pipelineStageConfigAllows(config, 'Contato realizado'), false);
  assert.equal(pipelineStageConfigAllows(config, 'Contato realizado', 'Contato realizado'), true);
  assert.equal(pipelineStageConfigAllows(config, 'Novo lead', 'Contato realizado'), true);
});

test('rejects empty or whitespace-only active and archived stage labels', () => {
  assert.notEqual(validatePipelineStageConfig({ ...valid, stages: [...valid.stages.slice(0, -2), '', ...valid.stages.slice(-2)] }), null);
  assert.notEqual(validatePipelineStageConfig({ ...valid, inactiveStages: ['   '] }), null);
});
