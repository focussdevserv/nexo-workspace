import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('workspace permission override column is added incrementally and journaled', async () => {
  const migration = await readFile(new URL('../drizzle/0008_workspace_permissions.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  assert.match(migration, /ALTER TABLE "users" ADD COLUMN "permissions" jsonb/);
  assert.equal(journal.entries.find((entry) => entry.tag === '0008_workspace_permissions')?.idx, 8);
});
