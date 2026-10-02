import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDriveFileSize } from './drive-file-presentation.js';

test('missing Drive file sizes are not presented as zero-byte files', () => {
  assert.equal(formatDriveFileSize(null), 'Não informado');
  assert.equal(formatDriveFileSize(undefined), 'Não informado');
  assert.equal(formatDriveFileSize(''), 'Não informado');
  assert.equal(formatDriveFileSize('unknown'), 'Não informado');
});

test('explicit Drive file sizes retain zero-byte and MiB display values', () => {
  assert.equal(formatDriveFileSize(0), '0.00 MB');
  assert.equal(formatDriveFileSize('1048576'), '1.00 MB');
  assert.equal(formatDriveFileSize(-1), 'Não informado');
});
