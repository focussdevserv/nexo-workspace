import test from 'node:test';
import assert from 'node:assert/strict';
import { moveLeadById } from './pipeline-stage.js';

test('moves only the requested lead ID and preserves its other fields', () => {
  const leads = [{ id: '1', name: 'Acme', stage: 'Novo lead', value: 'R$ 1.000', notes: 'briefing' }, { id: '2', name: 'Acme', stage: 'Negociação' }];
  assert.deepEqual(moveLeadById(leads, '1', 'Proposta enviada'), [{ ...leads[0], stage: 'Proposta enviada' }, leads[1]]);
  assert.equal(moveLeadById(leads, 'missing', 'Fechado'), leads);
});
