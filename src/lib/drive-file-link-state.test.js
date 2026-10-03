import assert from 'node:assert/strict';
import test from 'node:test';
import { driveFileLinkState } from './drive-file-link-state.js';

test('Drive linking waits until workspace records are loaded before checking duplicates', () => {
  assert.equal(driveFileLinkState({ driveFileId: 'drive-1' }), 'workspace_loading');
  assert.equal(driveFileLinkState({ driveFileId: 'drive-1', filesLoaded: true, filesError: 'API unavailable' }), 'workspace_error');
});

test('Drive linking rejects duplicate and concurrent links, and allows a new file', () => {
  const loaded = { filesLoaded: true, files: [{ driveFileId: 'drive-1' }] };
  assert.equal(driveFileLinkState({ ...loaded, driveFileId: 'drive-1' }), 'already_linked');
  assert.equal(driveFileLinkState({ filesLoaded: true, driveFileId: 'drive-2', linkingId: 'drive-2' }), 'linking');
  assert.equal(driveFileLinkState({ ...loaded, driveFileId: 'drive-2' }), 'ready');
});
