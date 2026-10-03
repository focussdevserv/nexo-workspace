import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('lead editor loads and saves the same close probability in both save paths', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const editor = source.slice(source.indexOf('function LeadRecordModal'), source.indexOf('function Identity'));
  const create = source.slice(source.indexOf('const createRecord ='), source.indexOf('const updateRecord ='));

  assert.match(editor, /chance:\s*lead\.chance === null \|\| lead\.chance === undefined \|\| lead\.chance === ""/);
  assert.match(editor, /Chance de fechamento \(%\)<input type="number" min="0" max="100"/);
  assert.equal((editor.match(/chance:\s*Number\(draft\.chance\)/g) || []).length, 2);
  assert.match(create, /Chance de fechamento \(%\)<input type="number" min="0" max="100"/);
  assert.match(create, /chance:\s*Number\(draft\.chance \?\? 50\)/);
});
