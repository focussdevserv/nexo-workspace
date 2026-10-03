import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialStageTone } from './commercial-stage-tone.js';

test('marks lost, declined, canceled, and expired commercial records as red', () => {
  for (const stage of ['Perdido', 'Recusada', 'Cancelado', 'Cancelada', 'Expirada', 'Vencida']) {
    assert.equal(commercialStageTone(stage), 'red', stage);
  }
});

test('keeps active pipeline stages distinct and normalizes accents and casing', () => {
  assert.equal(commercialStageTone('Novo lead'), 'blue');
  assert.equal(commercialStageTone('QUALIFICAÇÃO'), 'purple');
  assert.equal(commercialStageTone('Reunião agendada'), 'amber');
  assert.equal(commercialStageTone('Negociação'), 'green');
  assert.equal(commercialStageTone('Rascunho'), 'gray');
});
