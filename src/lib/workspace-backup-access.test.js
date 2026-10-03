import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canUseWorkspaceBackup, workspaceBackupUnavailableReason } from './workspace-backup-access.js';

test('workspace backup requires owner access and a real workspace session', () => {
  assert.equal(canUseWorkspaceBackup({ isOwner: true, localDemo: false }), true);
  assert.equal(canUseWorkspaceBackup({ isOwner: true, localDemo: true }), false);
  assert.equal(canUseWorkspaceBackup({ isOwner: false, localDemo: false }), false);
  assert.equal(canUseWorkspaceBackup({ isOwner: true }), false);
});

test('explains separately why owner and local-demo backup actions are unavailable', () => {
  assert.match(workspaceBackupUnavailableReason({ isOwner: false, localDemo: false }), /Somente a pessoa proprietária/i);
  assert.match(workspaceBackupUnavailableReason({ isOwner: true, localDemo: true }), /indisponível na demonstração local/i);
});

test('settings disables demo backup controls and guards both handlers before API access', async () => {
  const screen = await readFile(new URL('../screens/SettingsScreen.jsx', import.meta.url), 'utf8');
  assert.match(screen, /disabled=\{backupBusy \|\| isLocalDemoActive\(\)\}/);
  assert.match(screen, /if \(!canUseWorkspaceBackup\(\{ isOwner, localDemo \}\)\) \{ notify\(workspaceBackupUnavailableReason/);
  assert.match(screen, /if \(!canUseWorkspaceBackup\(\{ isOwner, localDemo \}\)\) throw new Error\(workspaceBackupUnavailableReason/);
  assert.match(screen, /role="note">\{workspaceBackupUnavailableReason\(\{ isOwner, localDemo: true \}\)\}/);
});
