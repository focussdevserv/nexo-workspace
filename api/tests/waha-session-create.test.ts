import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('WAHA session persistence and its audit event commit atomically before failed setup is compensated', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/integrations/waha/sessions'");
  const end = source.indexOf("app.get('/api/integrations/waha/sessions/:id/qr'", start);
  assert.ok(start >= 0 && end > start, 'WAHA session create route should be present');
  const route = source.slice(start, end);
  const transactionStart = route.indexOf('const row = await db.transaction(async (tx) => {');
  const transactionEnd = route.indexOf('});', transactionStart);
  const transaction = route.slice(transactionStart, transactionEnd);
  assert.ok(transactionStart >= 0 && transactionEnd > transactionStart, 'session persistence should use one transaction');
  assert.match(transaction, /tx\.insert\(workspaceRecords\)/);
  assert.match(transaction, /tx\.insert\(activityEvents\)/);
  assert.ok(transaction.indexOf('tx.insert(activityEvents)') > transaction.indexOf('tx.insert(workspaceRecords)'), 'audit event must be written in the same transaction after the session record');
  assert.match(route.slice(transactionEnd), /catch \(error\) \{[\s\S]*?wahaRequest\(`\/api\/sessions\/\$\{encodeURIComponent\(sessionName\)\}`, \{ method: 'DELETE' \}\)/);
});
