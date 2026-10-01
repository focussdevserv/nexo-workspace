import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTableRows, tableStatusOptions } from './table-status-filter.js';

test('offers every status present in the table and filters by status and search together', () => {
  const rows = [['1', 'Ana', 'Pendente'], ['2', 'Bia', 'Em atraso'], ['3', 'Caio', 'Recebida'], ['4', 'Dani', 'Cancelada'], ['5', 'Eva', 'Em processamento']];
  assert.deepEqual(tableStatusOptions(rows, 2), ['Todos', 'Pendente', 'Em atraso', 'Recebida', 'Cancelada', 'Em processamento']);
  assert.deepEqual(filterTableRows(rows, { status: 'Pendente', statusColumn: 2, query: 'ana' }), [['1', 'Ana', 'Pendente']]);
  assert.deepEqual(filterTableRows(rows, { status: 'Todos', statusColumn: 2, query: 'nao existe' }), []);
});
