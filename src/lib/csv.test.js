import test from 'node:test';
import assert from 'node:assert/strict';
import { recordsToCsv, rowsToCsv } from './csv.js';

test('exports semicolon-separated UTF-8-ready rows with quotes and nested values', () => {
  const csv = recordsToCsv([{ name: 'Clínica; "Vida"', services: [{ name: 'Site' }, 'Suporte'], amount: 45.67 }]);
  assert.equal(csv, '"name";"services";"amount"\r\n"Clínica; ""Vida""";"{""name"":""Site""}, Suporte";"45.67"');
});

test('protects spreadsheet formulas and omits credentials, including nested fields', () => {
  const csv = recordsToCsv([{ name: '=HYPERLINK("https://example.test")', apiToken: 'secret', config: { password: 'secret', visible: 'ok' } }]);
  assert.equal(csv, '"name";"config"\r\n"\'=HYPERLINK(""https://example.test"")";"{""visible"":""ok""}"');
  assert.equal(csv.includes('secret'), false);
});

test('returns an empty CSV for an empty record list', () => {
  assert.equal(recordsToCsv([]), '');
});

test('escapes arbitrary report rows and prevents spreadsheet formula execution', () => {
  assert.equal(rowsToCsv([['Título', 'Categoria'], ['=1+1', 'Serviço; pacote']]), '"Título";"Categoria"\r\n"\'=1+1";"Serviço; pacote"');
});
