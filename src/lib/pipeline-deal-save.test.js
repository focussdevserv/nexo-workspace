import assert from 'node:assert/strict';
import test from 'node:test';
import { persistPipelineLeadDeal, pipelineLeadEditDraft } from './pipeline-deal-save.js';

test('keeps a failed lead save distinguishable so the editor stays open', async () => {
  const lead = { id: 'lead-1' };
  const draft = { stage: 'Negociação', value: 'R$ 2.000', notes: 'Revisar escopo' };
  let received;
  const saved = await persistPipelineLeadDeal(async (...args) => {
    received = args;
    return false;
  }, lead, draft);

  assert.equal(saved, false);
  assert.deepEqual(received, [lead, { value: 'R$ 2.000', notes: 'Revisar escopo', stage: 'Negociação' }]);
});

test('reports confirmed persistence so the editor can close only after success', async () => {
  assert.equal(await persistPipelineLeadDeal(async () => true, { id: 'lead-1' }, { stage: 'Negociação' }), true);
  assert.equal(await persistPipelineLeadDeal(undefined, { id: 'lead-1' }, { stage: 'Negociação' }), false);
});

test('does not invent an owner when opening an opportunity with no assigned responsible', () => {
  assert.equal(pipelineLeadEditDraft({ id: 'lead-1', stage: 'Negociação' }).owner, '');
  assert.equal(pipelineLeadEditDraft({ id: 'lead-2', owner: 'Ana' }).owner, 'Ana');
});
