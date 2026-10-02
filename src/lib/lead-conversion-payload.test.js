import test from 'node:test';
import assert from 'node:assert/strict';
import { leadConversionPayload, leadFieldsBeforeConversion } from './lead-conversion-payload.js';

test('omits the pipeline stage from the conversion payload and keeps lead fields', () => {
  assert.deepEqual(leadConversionPayload({ stage: 'Fechado', source: 'Manual', value: 'R$ 2000' }), {
    source: 'Manual', value: 'R$ 2000',
  });
});

test('keeps only fields accepted by the strict conversion endpoint', () => {
  assert.deepEqual(leadConversionPayload({
    stage: 'Fechado', name: 'Ana', email: 'ana@example.com', company: 'Acme',
    value: 'R$ 2000', source: 'Site', notes: 'Interessada',
  }), { value: 'R$ 2000', source: 'Site', notes: 'Interessada' });
});

test('preserves all modal edits separately so identity changes are saved before conversion', () => {
  assert.deepEqual(leadFieldsBeforeConversion({ stage: 'Fechado', name: 'Ana', email: 'ana@example.com' }), {
    name: 'Ana', email: 'ana@example.com',
  });
});

test('supports conversion without extra editable data', () => {
  assert.deepEqual(leadConversionPayload(), {});
});
