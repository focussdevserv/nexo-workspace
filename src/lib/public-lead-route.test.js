import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const publicForm = readFileSync(new URL('../screens/PublicLeadForm.jsx', import.meta.url), 'utf8');
const manager = readFileSync(new URL('../screens/PublicLeadFormManager.jsx', import.meta.url), 'utf8');

test('capture route is evaluated before authenticated workspace access', () => {
  assert.ok(app.indexOf("pathname.startsWith('/captura/')") < app.indexOf('return <WorkspaceAccess>'));
});

test('public submission posts to the public API with consent, honeypot, and stable request key', () => {
  assert.match(publicForm, /\/api\/public\/crm\/leads\/\$\{encodeURIComponent\(slug\)\}/);
  assert.match(publicForm, /'Idempotency-Key': key\.current/);
  assert.match(publicForm, /publicLeadPayload\(values, startedAt\.current\)/);
  assert.match(publicForm, /name="contactConsent"/);
  assert.match(publicForm, /name="marketingConsent"/);
  assert.match(publicForm, /name="website"/);
  assert.match(publicForm, /href="\/privacy"/);
});

test('public form configuration is owner-gated and demo mode cannot call configuration APIs', () => {
  assert.match(manager, /if \(!isOwner\) return null/);
  assert.match(manager, /publicLeadFormManagerState\(\{ isOwner, localDemo \}\)/);
  assert.match(manager, /if \(!state\.available\) return/);
  assert.match(manager, /GET|\/api\/workspace\/crm\/public-lead-form/);
  assert.match(manager, /PUT|method: 'PUT'/);
});
