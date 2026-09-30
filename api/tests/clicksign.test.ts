import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clicksignBaseUrl, createClicksignEnvelope } from '../src/integrations/clicksign.js';

test('limits Clicksign base URLs to the official sandbox and production origins', () => {
  assert.equal(clicksignBaseUrl(), 'https://sandbox.clicksign.com');
  assert.equal(clicksignBaseUrl('https://app.clicksign.com'), 'https://app.clicksign.com');
  assert.throws(() => clicksignBaseUrl('http://sandbox.clicksign.com'), /clicksign_invalid_base_url/);
  assert.throws(() => clicksignBaseUrl('https://sandbox.clicksign.com.attacker.example'), /clicksign_invalid_base_url/);
  assert.throws(() => clicksignBaseUrl('https://sandbox.clicksign.com/path'), /clicksign_invalid_base_url/);
});

test('creates and activates an envelope with a document, signer, signature and email evidence requirements', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const ids = ['env-1', 'doc-1', 'signer-1'];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const id = ids.shift();
    return new Response(JSON.stringify(id ? { data: { id } } : { data: { id: `requirement-${calls.length}` } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const result = await createClicksignEnvelope({ baseUrl: 'https://sandbox.clicksign.com', token: 'test-access-token', name: 'CTR-01 - Site', filename: 'CTR-01.txt', text: 'Contrato completo', signerName: 'Maria Silva', signerEmail: 'maria@example.com' });
    assert.deepEqual(result, { envelopeId: 'env-1', documentId: 'doc-1', signerId: 'signer-1' });
    assert.equal(calls.length, 6);
    assert.ok(calls.every(({ init }) => (init.headers as Record<string, string>).Authorization === 'test-access-token'));
    assert.ok(calls.every(({ init }) => !(init.headers as Record<string, string>).Authorization.startsWith('Bearer ')));
    const upload = JSON.parse(String(calls[1]?.init.body));
    assert.equal(upload.data.attributes.filename, 'CTR-01.txt');
    assert.equal(Buffer.from(upload.data.attributes.content_base64.split(',')[1], 'base64').toString('utf8'), 'Contrato completo');
    const qualification = JSON.parse(String(calls[3]?.init.body));
    assert.deepEqual(qualification.data.attributes, { action: 'agree', role: 'sign' });
    const evidence = JSON.parse(String(calls[4]?.init.body));
    assert.deepEqual(evidence.data.attributes, { action: 'provide_evidence', auth: 'email' });
    assert.equal(JSON.parse(String(calls[5]?.init.body)).data.attributes.status, 'running');
  } finally { globalThis.fetch = originalFetch; }
});
