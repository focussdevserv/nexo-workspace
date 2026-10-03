import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { commercialRecordTargetMatches } from './commercial-record-target.js';

test('matches a record by explicit ID even when its display name is duplicated', () => {
  const rows = [
    { id: 'company-a', name: 'Acme' },
    { id: 'company-b', name: 'Acme' },
  ];
  assert.deepEqual(commercialRecordTargetMatches(rows, { id: 'company-b', name: 'Acme' }), [1]);
});

test('reports an ambiguous id-less legacy target instead of matching every duplicate', () => {
  const rows = [
    { name: 'Acme' },
    { name: 'Acme' },
    { id: 'company-c', name: 'Acme' },
  ];
  assert.deepEqual(commercialRecordTargetMatches(rows, { name: 'Acme' }), [0, 1]);
});

test('uses a unique title fallback only for a row that also has no ID', () => {
  const rows = [
    { title: 'Proposal' },
    { id: 'proposal-2', title: 'Proposal' },
  ];
  assert.deepEqual(commercialRecordTargetMatches(rows, { title: 'Proposal' }), [0]);
  assert.deepEqual(commercialRecordTargetMatches(rows, { id: 'missing', title: 'Proposal' }), []);
});

test('commercial edit and delete handlers refuse stale or ambiguous matches', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /const matchingIndexes = commercialRecordTargetMatches\(records\[recordType\] \|\| \[\], record\);/g);
  assert.match(source, /if \(matchingIndexes\.length !== 1\)/g);
  assert.match(source, /\[recordType\]: \(records\[recordType\] \|\| \[\]\)\.filter\(\(_, index\) => index !== targetIndex\)/);
});
