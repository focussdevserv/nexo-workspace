import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('password reset migration stores only hashed one-time tokens and adds session revocation version', async () => {
  const migration = await readFile(new URL('../drizzle/0009_password_reset.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };

  assert.match(migration, /ADD COLUMN session_version integer NOT NULL DEFAULT 0/);
  assert.match(migration, /CREATE TABLE password_reset_tokens/);
  assert.match(migration, /token_hash text NOT NULL UNIQUE/);
  assert.match(migration, /expires_at timestamptz NOT NULL/);
  assert.match(migration, /used_at timestamptz/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.equal(journal.entries.find((entry) => entry.tag === '0009_password_reset')?.idx, 9);
});
