import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCommercialRecords } from './commercial-record-filter.js';

const records = Array.from({ length: 23 }, (_, index) => ({
  id: index,
  name: `Empresa ${index}`,
  city: index % 2 ? 'São Paulo' : 'Santos',
  status: index % 2 ? 'Ativo' : 'Prospect',
  source: index % 3 ? 'Site' : 'Indicação',
}));

test('returns the full loaded list without artificial page slicing', () => {
  assert.equal(filterCommercialRecords(records).length, records.length);
});

test('combines search, status/source filters and extra fields over the full list', () => {
  const result = filterCommercialRecords(records, {
    search: 'Empresa 1',
    filter: 'Ativo',
    extraFilters: { city: 'São Paulo' },
    extraFilterFields: [{ key: 'city', label: 'Cidade', values: ['Santos', 'São Paulo'] }],
  });
  assert.deepEqual(result.map((record) => record.id), [1, 11, 13, 15, 17, 19]);
});

test('search includes nested commercial metadata', () => {
  const result = filterCommercialRecords([{ id: 1, name: 'Nexo', emailDelivery: { recipient: 'ops@nexo.test' } }], { search: 'ops@nexo.test' });
  assert.equal(result.length, 1);
});

test('archived clients are isolated from active status filters and remain searchable on demand', () => {
  const clients = [
    { id: 1, name: 'Ativo', status: 'Ativo' },
    { id: 2, name: 'Arquivo', status: 'Inativo', archivedAt: '2026-10-02T12:00:00.000Z' },
  ];
  assert.deepEqual(filterCommercialRecords(clients, { filter: 'Todos' }).map(({ id }) => id), [1]);
  assert.deepEqual(filterCommercialRecords(clients, { filter: 'Inativo' }).map(({ id }) => id), []);
  assert.deepEqual(filterCommercialRecords(clients, { filter: 'Arquivado' }).map(({ id }) => id), [2]);
  assert.deepEqual(filterCommercialRecords(clients, { filter: 'Arquivado', search: 'Arquivo' }).map(({ id }) => id), [2]);
});

test('lead follow-up filter finds open records without a next action', () => {
  const leads = [
    { id: 1, stage: 'Novo lead' },
    { id: 2, stage: 'Negociação', nextAction: 'Enviar proposta' },
    { id: 3, stage: 'Fechado' },
    { id: 4, stage: 'Perdido' },
  ];
  assert.deepEqual(filterCommercialRecords(leads, { filter: 'Sem pr\u00f3xima a\u00e7\u00e3o' }).map(({ id }) => id), [1]);
});
