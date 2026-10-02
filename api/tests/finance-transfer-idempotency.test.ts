import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { financeTransferReplayMatches, type FinanceTransferRow } from '../src/integrations/finance-transfer-idempotency.ts';

const request = {
  sourceAccountId: 'source-id',
  destinationAccountId: 'destination-id',
  description: 'Reserva de impostos',
  amount: 120.5,
  date: '2026-10-02',
};

const rows: FinanceTransferRow[] = [
  { id: 'debit-id', data: { transferSide: 'debit', direction: 'Saída', accountId: request.sourceAccountId, relatedAccountId: request.destinationAccountId, description: request.description, amount: 120.5, date: request.date } },
  { id: 'credit-id', data: { transferSide: 'credit', direction: 'Entrada', accountId: request.destinationAccountId, relatedAccountId: request.sourceAccountId, description: request.description, amount: 120.5, date: request.date } },
];

test('recognizes an exact retry of an already committed paired transfer', () => {
  assert.equal(financeTransferReplayMatches(rows, request), true);
  assert.equal(financeTransferReplayMatches([rows[0]!], request), false);
});

test('rejects reuse of a transfer idempotency key for a different payload', () => {
  assert.equal(financeTransferReplayMatches(rows, { ...request, amount: 120.51 }), false);
  assert.equal(financeTransferReplayMatches(rows, { ...request, destinationAccountId: 'other-destination' }), false);
  assert.equal(financeTransferReplayMatches(rows, { ...request, description: 'Outro destino' }), false);
});

test('serializes same-key requests and checks for committed rows before applying balances', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/workspace/finance-transfers'");
  const end = source.indexOf("app.post('/api/workspace/leads/:id/convert'", start);
  const route = source.slice(start, end);
  const lock = route.indexOf('pg_advisory_xact_lock');
  const priorCheck = route.indexOf('financeTransferReplayMatches');
  const balanceMutation = route.indexOf('calculateFinanceTransferBalances');

  assert.ok(start >= 0 && end > start);
  assert.ok(lock >= 0 && lock < priorCheck && priorCheck < balanceMutation);
  assert.match(route, /idempotencyKey: z\.string\(\)\.uuid\(\)\.optional\(\)/);
});
