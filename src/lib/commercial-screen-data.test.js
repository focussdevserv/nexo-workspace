import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommercialScreenRows } from './commercial-screen-data.js';

test('normalizes malformed Contact fields before the table renders them', () => {
  const source = [
    null,
    [],
    { id: 7, name: { first: 'Ana' }, role: 'Diretora', email: { address: 'ana@example.test' }, phone: 11999999999, status: { label: 'Decisor' } },
    { id: 8, name: 'João', role: 'Compras', email: 'joao@example.test', phone: '', status: 'Influenciador' },
  ];

  const rows = normalizeCommercialScreenRows('contacts', source);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { name: rows[0].name, role: rows[0].role, email: rows[0].email, phone: rows[0].phone, status: rows[0].status },
    { name: '', role: 'Diretora', email: '', phone: '11999999999', status: '' },
  );
  assert.equal(rows[0].id, 7);
  assert.equal(rows[1].name, 'João');
  assert.equal(rows[1].status, 'Influenciador');
  assert.equal(source[2].name.first, 'Ana');
});

test('keeps CRM lead card fields render-safe without mutating stored data', () => {
  const source = [{ id: 9, name: 'Lead', stage: { name: 'Negociação' }, company: 'Acme', value: 1200 }];
  const [row] = normalizeCommercialScreenRows('leads', source);
  assert.equal(row.name, 'Lead');
  assert.equal(row.stage, '');
  assert.equal(row.value, '1200');
  assert.deepEqual(source[0].stage, { name: 'Negociação' });
});

test('ignores invalid collection values but preserves unknown resources', () => {
  assert.deepEqual(normalizeCommercialScreenRows('contacts', null), []);
  const [row] = normalizeCommercialScreenRows('other', [{ id: 1, custom: { value: 'kept' } }]);
  assert.deepEqual(row.custom, { value: 'kept' });
});
