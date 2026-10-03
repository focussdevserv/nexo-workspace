import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { linkedFinanceTransferIds } from '../src/integrations/finance-account-deletion.ts';

test('detects each linked transfer once while ignoring standalone or malformed movements', () => {
  assert.deepEqual(linkedFinanceTransferIds([
    { data: { transferId: 'transfer-a', direction: 'Saída' } },
    { data: { transferId: 'transfer-a', direction: 'Entrada' } },
    { data: { transferId: 'transfer-b' } },
    { data: { description: 'Manual entry' } },
    { data: null },
  ]), ['transfer-a', 'transfer-b']);
  assert.deepEqual(linkedFinanceTransferIds([]), []);
});

test('account deletion checks transfer links under an account row lock before archiving anything', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.delete('/api/workspace/finance-accounts/:id'");
  const end = source.indexOf("app.delete('/api/workspace/:resource/:id'", start);
  const route = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  const lock = route.indexOf(".for('update')");
  const transferCheck = route.indexOf('linkedFinanceTransferIds(linkedRows)');
  const accountArchive = route.indexOf('tx.update(workspaceRecords).set({ archivedAt');
  assert.ok(lock >= 0 && transferCheck > lock && accountArchive > transferCheck);
  assert.match(route, /finance_account_has_transfers/);
  assert.match(route, /reply\.code\(409\)/);
});
