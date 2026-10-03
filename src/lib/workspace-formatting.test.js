import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWorkspaceCurrency, formatWorkspaceDate, formatWorkspaceDateTime, formatWorkspaceNumber, formatWorkspaceTime } from './workspace-formatting.js';

test('workspace currency and number format follow locale and selected currency', () => {
  assert.match(formatWorkspaceCurrency(1234.5, { language: 'pt-BR', currency: 'BRL' }), /R\$/);
  assert.match(formatWorkspaceCurrency(1234.5, { language: 'en-US', currency: 'USD' }), /\$/);
  assert.equal(formatWorkspaceNumber(1234.5, { language: 'en-US' }), '1,234.5');
});

test('workspace date format affects date-only and timestamp display', () => {
  assert.equal(formatWorkspaceDate('2026-10-03', { language: 'pt-BR', dateFormat: 'dd/MM/yyyy' }), '03/10/2026');
  assert.equal(formatWorkspaceDate('2026-10-03', { language: 'en-US', dateFormat: 'MM/dd/yyyy' }), '10/03/2026');
  assert.equal(formatWorkspaceDate('2026-10-03', { language: 'en-US', dateFormat: 'yyyy-MM-dd' }), '2026-10-03');
  assert.match(formatWorkspaceDateTime('2026-10-03T10:30:00Z', { language: 'pt-BR' }), /03\/10\/2026/);
  assert.ok(formatWorkspaceTime('2026-10-03T10:30:00Z', { language: 'en-US' }).includes('AM'));
});

test('bad values do not throw and fall back to supported workspace defaults', () => {
  assert.match(formatWorkspaceCurrency(10, { language: 'invalid', currency: 'invalid' }), /R\$/);
  assert.equal(formatWorkspaceDate('no date', { language: 'invalid' }), '—');
  assert.equal(formatWorkspaceDate('2026-10-03', { language: 'pt-BR' }, { timeZone: 'Mars/Olympus' }), '03/10/2026');
  assert.match(formatWorkspaceDateTime('2026-10-03T10:30:00Z', { language: 'pt-BR' }, { timeZone: 'Mars/Olympus' }), /03\/10\/2026/);
});
