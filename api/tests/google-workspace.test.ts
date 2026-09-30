import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleRawMessage, decodeGoogleDriveUpload } from '../src/integrations/google-mail.js';
import { buildGoogleAuthorizationUrl } from '../src/integrations/google-oauth.js';

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

test('validates base64 drive uploads and enforces the configured size limit', () => {
  const input = Buffer.from('documento de proposta');
  assert.deepEqual(decodeGoogleDriveUpload(input.toString('base64')), input);
  assert.throws(() => decodeGoogleDriveUpload('not base64!'), /drive_upload_invalid/);
  assert.throws(() => decodeGoogleDriveUpload(Buffer.alloc(9).toString('base64'), 8), /drive_upload_invalid/);
});
