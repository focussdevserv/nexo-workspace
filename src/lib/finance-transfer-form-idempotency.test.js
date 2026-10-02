import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('a transfer keeps one idempotency key for retries and starts a fresh key for a new transfer', async () => {
  const source = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  const submitStart = source.indexOf('const submitTransfer = async');
  const submitEnd = source.indexOf('const exportCsv =', submitStart);
  const submit = source.slice(submitStart, submitEnd);
  const transferStart = source.indexOf('setTransferDraft({ description:');
  const transferEnd = source.indexOf('setTransferModal(true)', transferStart);
  const newTransfer = source.slice(transferStart, transferEnd);

  assert.ok(submitStart >= 0 && submitEnd > submitStart);
  assert.match(submit, /JSON\.stringify\(\{ \.\.\.transferDraft/);
  assert.equal((submit.match(/crypto\.randomUUID\(\)/g) || []).length, 0);
  assert.match(newTransfer, /idempotencyKey: crypto\.randomUUID\(\)/);
});
