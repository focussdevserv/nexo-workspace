import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalDemoFinanceDates } from './local-demo-finance.js';
import { handleLocalDemoRequest } from './local-demo.js';

function withDemoStore(store, callback) {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify(store)]]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try { return callback(values); }
  finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalStorage;
  }
}

test('local demo finance recurrence preserves month-end anchors and due-date offsets', () => {
  assert.deepEqual(buildLocalDemoFinanceDates('2026-01-31', '2026-02-05', 'monthly', 3), [
    { date: '2026-01-31', dueDate: '2026-02-05' },
    { date: '2026-02-28', dueDate: '2026-03-05' },
    { date: '2026-03-31', dueDate: '2026-04-05' },
  ]);
  assert.deepEqual(buildLocalDemoFinanceDates('2026-10-02', null, 'weekly', 2), [
    { date: '2026-10-02', dueDate: null },
    { date: '2026-10-09', dueDate: null },
  ]);
  assert.throws(() => buildLocalDemoFinanceDates('2026-02-30', null, 'monthly', 2));
});

test('local demo finance recurrence persists populated rows and replays the same series idempotently', () => withDemoStore({ revenues: [], expenses: [] }, (values) => {
  const body = { seriesId: 'd6465e54-8e0f-4c75-bcf7-e91655d32a47', frequency: 'monthly', count: 3, data: { description: 'Plano mensal', amount: 75, date: '2026-01-31', dueDate: '2026-02-05', status: 'Pendente', code: 'REC-111' } };
  const first = handleLocalDemoRequest('/api/workspace/revenues/recurring', { method: 'POST', body: JSON.stringify(body) });
  assert.equal(first.data.records.length, 3);
  assert.equal(first.data.records[0].recurrenceSequence, 1);
  assert.equal(first.data.records[2].date, '2026-03-31');
  const replay = handleLocalDemoRequest('/api/workspace/revenues/recurring', { method: 'POST', body: JSON.stringify({ ...body, data: { ...body.data, code: 'REC-222' } }) });
  assert.equal(replay.data.idempotent, true);
  assert.equal(replay.data.records.length, 3);
  assert.equal(handleLocalDemoRequest('/api/workspace/revenues?limit=200&offset=0').data.length, 3);
  assert.throws(() => handleLocalDemoRequest('/api/workspace/revenues/recurring', { method: 'POST', body: JSON.stringify({ ...body, count: 4 }) }), /outros dados/i);
  const saved = JSON.parse(values.get('focusshub.local-demo.v1'));
  assert.equal(saved.revenues.length, 3);
}));

test('local demo one-time finance creation deduplicates retries by request key and rejects changed payload reuse', () => withDemoStore({ revenues: [], expenses: [] }, (values) => {
  const options = { method: 'POST', headers: { 'Idempotency-Key': 'd6465e54-8e0f-4c75-bcf7-e91655d32a48' }, body: JSON.stringify({ data: { description: 'Domínio', amount: 140, code: 'REC-111' } }) };
  const first = handleLocalDemoRequest('/api/workspace/revenues', options);
  const replay = handleLocalDemoRequest('/api/workspace/revenues', { ...options, body: JSON.stringify({ data: { description: 'Domínio', amount: 140, code: 'REC-222' } }) });
  assert.equal(first.data.id, replay.data.id);
  assert.equal(replay.data.idempotent, true);
  assert.equal(handleLocalDemoRequest('/api/workspace/revenues?limit=200&offset=0').data.length, 1);
  assert.throws(() => handleLocalDemoRequest('/api/workspace/revenues', { ...options, body: JSON.stringify({ data: { description: 'Domínio', amount: 150 } }) }), /outros dados/i);
  assert.equal(JSON.parse(values.get('focusshub.local-demo.v1')).revenues.length, 1);
}));
