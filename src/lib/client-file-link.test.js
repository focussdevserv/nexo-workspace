import assert from 'node:assert/strict';
import test from 'node:test';
import { clientFileRecordForUpload } from './client-file-link.js';

test('client profile upload metadata is linked to the selected client and project', () => {
  const record = clientFileRecordForUpload(
    { id: 'client-1', name: 'Acme' },
    { id: 'drive-1', name: 'brief.pdf', mimeType: 'application/pdf', size: 1024, url: 'https://drive.google.com/file/d/drive-1/view' },
    { project: { id: 'project-1', name: 'Site' }, createdAt: '2026-10-02T12:00:00Z' },
  );
  assert.equal(record.clientId, 'client-1');
  assert.equal(record.client, 'Acme');
  assert.equal(record.projectId, 'project-1');
  assert.equal(record.driveFileId, 'drive-1');
  assert.equal(record.type, 'pdf');
});

test('demo upload records keep client context without claiming a Drive upload', () => {
  const record = clientFileRecordForUpload(
    { id: 'client-1', name: 'Acme' }, { id: 'demo-1', name: 'notes.txt', size: 0 },
    { localOnly: true },
  );
  assert.equal(record.clientId, 'client-1');
  assert.equal(record.localOnly, true);
  assert.equal(record.driveFileId, undefined);
  assert.equal(record.url, '');
});

test('file linking rejects incomplete client or upload metadata', () => {
  assert.throws(() => clientFileRecordForUpload(null, { id: 'file-1', name: 'x.pdf' }), /client_file_link_invalid/);
  assert.throws(() => clientFileRecordForUpload({ id: 'client-1' }, { id: 'file-1' }), /client_file_link_invalid/);
});
