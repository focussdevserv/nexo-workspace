import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGoogleDriveListFailure, googleDriveFileMetadataUrl, googleDriveFilesListUrl, mapGoogleDriveFile } from '../src/integrations/google-drive.js';

test('builds a read-only Drive listing request with bounded fields and the current app-accessible scope', () => {
  const url = new URL(googleDriveFilesListUrl('page-token-1'));
  assert.equal(url.origin, 'https://www.googleapis.com');
  assert.equal(url.pathname, '/drive/v3/files');
  assert.equal(url.searchParams.get('q'), 'trashed = false');
  assert.equal(url.searchParams.get('pageSize'), '100');
  assert.equal(url.searchParams.get('orderBy'), 'modifiedTime desc');
  assert.equal(url.searchParams.get('pageToken'), 'page-token-1');
  assert.equal(url.searchParams.get('supportsAllDrives'), 'true');
  assert.match(url.searchParams.get('fields') || '', /files\(id,name,mimeType,size,modifiedTime,webViewLink\)/);
  assert.doesNotMatch(url.toString(), /drive\.readonly|drive\.metadata/);
  assert.throws(() => googleDriveFilesListUrl('x'.repeat(2049)), /google_drive_page_token_invalid/);
});

test('maps only safe Drive metadata and builds a canonical link when Google omits one', () => {
  assert.deepEqual(mapGoogleDriveFile({ id: 'drive-id', name: 'Briefing', mimeType: 'application/pdf', size: '512', modifiedTime: '2026-10-01T10:00:00.000Z' }), {
    id: 'drive-id', name: 'Briefing', mimeType: 'application/pdf', size: 512,
    modifiedAt: '2026-10-01T10:00:00.000Z', url: 'https://drive.google.com/open?id=drive-id',
  });
  assert.equal(mapGoogleDriveFile({ id: 'bad\nid', name: 'Bad' }), null);
  assert.equal(mapGoogleDriveFile({ id: 'id-only' }), null);
});

test('builds a bounded metadata URL for a single Drive file and rejects unsafe IDs', () => {
  const url = new URL(googleDriveFileMetadataUrl('drive_file-123'));
  assert.equal(url.origin, 'https://www.googleapis.com');
  assert.equal(url.pathname, '/drive/v3/files/drive_file-123');
  assert.equal(url.searchParams.get('supportsAllDrives'), 'true');
  assert.equal(url.searchParams.get('fields'), 'id,name,mimeType,size,modifiedTime,webViewLink');
  assert.throws(() => googleDriveFileMetadataUrl('bad/id'), /google_drive_file_id_invalid/);
});

test('only expired authorization offers reauthorization; Drive API denial explains configuration', () => {
  assert.equal(classifyGoogleDriveListFailure(401).code, 'google_authorization_required');
  assert.equal(classifyGoogleDriveListFailure(403).code, 'google_drive_access_limited');
  assert.match(classifyGoogleDriveListFailure(403).message, /API.*habilitada/i);
  assert.equal(classifyGoogleDriveListFailure(500).code, 'google_drive_list_failed');
});
