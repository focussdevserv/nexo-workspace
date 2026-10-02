import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleRawMessage, decodeGoogleDriveUpload, decodeGoogleMailAttachments, googleMailAddresses, googleThreadBelongsToAllowedContacts, mapGoogleMailMessage } from '../src/integrations/google-mail.js';
import { buildGoogleAuthorizationUrl, googleOAuthStateRecordIsActive } from '../src/integrations/google-oauth.js';

test('limits scoped Gmail threads to assigned contacts and the connected account', () => {
  const emails = googleMailAddresses(['Ana <ANA@example.com>, suporte@example.com', null, 'invalid']);
  const allowed = new Set(['ana@example.com']);
  assert.deepEqual(emails, ['ana@example.com', 'suporte@example.com']);
  assert.equal(googleThreadBelongsToAllowedContacts(['ana@example.com', 'agencia@example.com'], allowed, 'agencia@example.com'), true);
  assert.equal(googleThreadBelongsToAllowedContacts(['ana@example.com', 'other-client@example.com'], allowed, 'agencia@example.com'), false);
});

test('requests offline Google access with the complete workspace scopes and OAuth state', () => {
  const state = 'signed-state-with-reserved+characters/';
  const authorizationUrl = new URL(buildGoogleAuthorizationUrl({
    clientId: 'client-id.apps.googleusercontent.com',
    redirectUri: 'https://focussdev.space/api/integrations/google/callback',
    scopes: [
      'openid', 'email', 'profile',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    state,
  }));

  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.pathname, '/o/oauth2/v2/auth');
  assert.equal(authorizationUrl.searchParams.get('client_id'), 'client-id.apps.googleusercontent.com');
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'https://focussdev.space/api/integrations/google/callback');
  assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
  assert.equal(authorizationUrl.searchParams.get('access_type'), 'offline');
  assert.equal(authorizationUrl.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(authorizationUrl.searchParams.get('prompt'), 'consent');
  assert.equal(authorizationUrl.searchParams.get('state'), state);
  assert.deepEqual(authorizationUrl.searchParams.get('scope')?.split(' '), [
    'openid', 'email', 'profile',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ]);
});

test('encodes proposal mail as RFC 2045 multipart UTF-8 Gmail raw message', () => {
  const raw = buildGoogleRawMessage({ to: 'cliente@example.com', subject: 'Proposta: criação de site', text: 'Olá, cliente!', html: '<p>Olá, cliente!</p>' });
  const message = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(message, /To: cliente@example\.com/);
  assert.match(message, /Subject: =\?UTF-8\?B\?/);
  assert.match(message, /multipart\/alternative/);
  assert.match(message, /Content-Type: text\/html; charset="UTF-8"/);
  assert.match(message, /Content-Type: text\/plain; charset="UTF-8"/);
  assert.ok(message.includes(Buffer.from('Olá, cliente!').toString('base64')));
});

test('Google OAuth callbacks require the issued state row and cannot replay a consumed callback', () => {
  const issued = { callbackState: 'signed-state', cookieState: 'signed-state', expectedNonce: 'issued-once', recordNonce: 'issued-once', recordExpiresAt: Date.now() + 60_000, recordActive: true };
  assert.equal(googleOAuthStateRecordIsActive(issued), true);
  assert.equal(googleOAuthStateRecordIsActive({ ...issued, recordActive: false }), false);
  assert.equal(googleOAuthStateRecordIsActive({ ...issued, recordNonce: 'other-state' }), false);
  assert.equal(googleOAuthStateRecordIsActive({ ...issued, cookieState: undefined }), false);
});

test('encodes Gmail attachments as safe multipart MIME parts', () => {
  const data = Buffer.from('binary attachment \0\u00e7');
  const attachments = decodeGoogleMailAttachments([{ filename: 'brief \u00e7.pdf', mimeType: 'application/pdf', contentBase64: data.toString('base64') }]);
  const message = Buffer.from(buildGoogleRawMessage({ to: 'client@example.com', subject: 'Proposal', text: 'See attached', html: '<p>See attached</p>', attachments }), 'base64url').toString('utf8');
  assert.match(message, /multipart\/mixed/);
  assert.match(message, /multipart\/alternative/);
  assert.match(message, /Content-Type: application\/pdf/);
  assert.match(message, /Content-Disposition: attachment; filename\*=UTF-8''brief%20%C3%A7\.pdf/);
  assert.ok(message.includes(data.toString('base64')));
});

test('rejects Gmail attachment header injection, excessive count, and total size', () => {
  const payload = Buffer.from('data').toString('base64');
  assert.throws(() => decodeGoogleMailAttachments([{ filename: 'safe.pdf\r\nBcc: victim@example.com', mimeType: 'application/pdf', contentBase64: payload }]), /gmail_attachment_invalid/);
  assert.throws(() => decodeGoogleMailAttachments(Array.from({ length: 6 }, (_, index) => ({ filename: `${index}.txt`, mimeType: 'text/plain', contentBase64: payload }))), /gmail_attachment_invalid/);
  assert.throws(() => decodeGoogleMailAttachments([
    { filename: 'a.txt', mimeType: 'text/plain', contentBase64: payload },
    { filename: 'b.txt', mimeType: 'text/plain', contentBase64: payload },
  ], 7), /gmail_attachment_invalid/);
});

test('validates base64 drive uploads and enforces the configured size limit', () => {
  const input = Buffer.from('documento de proposta');
  assert.deepEqual(decodeGoogleDriveUpload(input.toString('base64')), input);
  assert.throws(() => decodeGoogleDriveUpload('not base64!'), /drive_upload_invalid/);
  assert.throws(() => decodeGoogleDriveUpload(Buffer.alloc(9).toString('base64'), 8), /drive_upload_invalid/);
});

test('maps Gmail thread messages into safe readable inbox records', () => {
  const body = Buffer.from('Hello from Gmail').toString('base64url');
  const mapped = mapGoogleMailMessage({ id: 'message-1', threadId: 'thread-1', internalDate: '1790000000000', labelIds: ['INBOX', 'UNREAD'], payload: { headers: [
    { name: 'From', value: 'Jane Doe <jane@example.com>' }, { name: 'To', value: 'owner@example.com' },
    { name: 'Subject', value: '=?UTF-8?B?UmV1bmnDo28=?=' }, { name: 'Message-ID', value: '<mail-1@example.com>' }, { name: 'References', value: '<root@example.com> <mail-1@example.com>' },
  ], parts: [{ mimeType: 'text/plain', body: { data: body } }] } }, 'owner@example.com');
  assert.equal(mapped.threadId, 'thread-1');
  assert.equal(mapped.subject, 'Reunião');
  assert.equal(mapped.text, 'Hello from Gmail');
  assert.equal(mapped.unread, true);
  assert.equal(mapped.side, 'received');
  assert.equal(mapped.references, '<root@example.com> <mail-1@example.com>');
});

test('adds safe threading headers to Gmail replies and ignores header injection', () => {
  const message = Buffer.from(buildGoogleRawMessage({ to: 'client@example.com', subject: 'Re: Scope', text: 'Reply', html: '<p>Reply</p>', inReplyTo: '<id@example.com>', references: '<id@example.com>\r\nBcc: bad@example.com' }), 'base64url').toString('utf8');
  assert.match(message, /In-Reply-To: <id@example.com>/);
  assert.doesNotMatch(message, /Bcc: bad@example.com/);
});
