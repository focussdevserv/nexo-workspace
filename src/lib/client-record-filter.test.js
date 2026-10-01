import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRecordsForClient } from './client-record-filter.js';

test('filters billing by workspace client ID when available', () => {
  const records = [{ id: 'a', workspaceClientId: 'one', clientName: 'Acme' }, { id: 'b', workspaceClientId: 'two', clientName: 'Acme' }, { id: 'c', clientName: 'Other' }];
  assert.deepEqual(filterRecordsForClient(records, { clientId: 'two', clientName: 'Acme' }).map(({ id }) => id), ['b']);
});

test('uses exact name matching for legacy unlinked records', () => {
  const records = [{ id: 'a', clientName: 'Acme' }, { id: 'b', clientName: 'Acme Studio' }];
  assert.deepEqual(filterRecordsForClient(records, { clientName: 'Acme' }).map(({ id }) => id), ['a']);
});

test('uses an exact legacy name only when records have no client links', () => {
  const records = [{ id: 'a', clientName: 'Acme' }, { id: 'b', clientName: 'Acme Studio' }];
  assert.deepEqual(filterRecordsForClient(records, { clientId: 'one', clientName: 'Acme' }).map(({ id }) => id), ['a']);
});
