import test from 'node:test';
import assert from 'node:assert/strict';
import { leadConversionPayload } from './lead-conversion-payload.js';

test('omits the pipeline stage from the conversion payload and keeps lead fields', () => {
  assert.deepEqual(leadConversionPayload({ stage: 'Fechado', source: 'Manual', value: 'R$ 2000' }), {
    source: 'Manual', value: 'R$ 2000',
  });
});

test('supports conversion without extra editable data', () => {
  assert.deepEqual(leadConversionPayload(), {});
});
