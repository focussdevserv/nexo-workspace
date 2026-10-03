import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldOpenFileDetailsByDefault } from './file-primary-action.js';

test('Drive and demo records open the details panel so metadata actions remain accessible', () => {
  assert.equal(shouldOpenFileDetailsByDefault({ driveFileId: 'drive-123', url: 'https://drive.google.com/file/d/drive-123' }), true);
  assert.equal(shouldOpenFileDetailsByDefault({ localOnly: true }), true);
  assert.equal(shouldOpenFileDetailsByDefault({ id: 'workspace-metadata-only' }), true);
});

test('external URL-only records keep their direct open behavior', () => {
  assert.equal(shouldOpenFileDetailsByDefault({ url: 'https://example.com/document.pdf' }), false);
});
