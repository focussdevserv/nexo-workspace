import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { financeAccountMovementReplayMatches, type FinanceAccountMovementRow } from '../src/integrations/finance-account-idempotency.ts';

const request = { accountId: 'account-id', description: 'Pagamento de hospedagem', direction: 'Saída' as const, amount: 89.9, date: '2026-10-03' };
const rows: FinanceAccountMovementRow[] = [{ id: 'movement-id', data: { ...request } }];

test('recognizes only an exact retry of a recorded account movement', () => {
  assert.equal(financeAccountMovementReplayMatches(rows, request), true);
  assert.equal(financeAccountMovementReplayMatches([], request), false);
  assert.equal(financeAccountMovementReplayMatches([{ ...rows[0]!, data: { ...request, amount: 90 } }], request), false);
  assert.equal(financeAccountMovementReplayMatches([{ ...rows[0]!, data: { ...request, accountId: 'another-account' } }], request), false);
  assert.equal(financeAccountMovementReplayMatches([{ ...rows[0]!, data: { ...request, date: '2026-10-04' } }], request), false);
});

test('account movement route checks a retry under lock before changing balance', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/finance-accounts/:id/transactions'");
  const end = source.indexOf("app.post('/api/workspace/finance-transfers'", start);
  const route = source.slice(start, end);
  const lock = route.indexOf('pg_advisory_xact_lock');
  const replay = route.indexOf('financeAccountMovementReplayMatches');
  const balanceMutation = route.indexOf('calculateAccountMovementBalance');
  assert.ok(start >= 0 && end > start);
  assert.ok(lock >= 0 && lock < replay && replay < balanceMutation);
  assert.match(route, /idempotencyKey: z\.string\(\)\.uuid\(\)\.optional\(\)/);
});
