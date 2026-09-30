import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { canApplyClicksignWebhookStatus, clicksignContractStatus, clicksignWebhookEnvelopeStatus, clicksignWebhookIsReady, parseClicksignWebhookEvent, verifyClicksignWebhook } from '../src/integrations/clicksign-webhook.js';

test('validates Clicksign signatures against exact raw bytes and rejects altered bodies', () => {
  const body = Buffer.from('{"event":{"name":"document_closed"},"document":{"key":"doc-1"}}');
  const secret = 'clicksign-webhook-secret-for-test';
  const signature = `sha256=${createHash('sha256').update(body).update(secret).digest('hex')}`;
  assert.equal(verifyClicksignWebhook(body, secret, signature), true);
  assert.equal(verifyClicksignWebhook(Buffer.from(`${body.toString()} `), secret, signature), false);
  assert.equal(verifyClicksignWebhook(body, secret, undefined), false);
  assert.equal(verifyClicksignWebhook(body, secret, 'sha256=not-a-digest'), false);
});

test('extracts document and envelope identifiers from Clicksign event payloads', () => {
  assert.deepEqual(parseClicksignWebhookEvent({ event: { name: 'document_closed' }, document: { id: 'doc-1', envelope: { id: 'env-1' } } }), {
    name: 'document_closed', documentId: 'doc-1', envelopeId: 'env-1', documentStatus: '',
  });
  assert.deepEqual(parseClicksignWebhookEvent({ event: { name: 'sign' }, document: [{ key: 'doc-legacy' }] }), {
    name: 'sign', documentId: 'doc-legacy', envelopeId: '', documentStatus: '',
  });
  assert.equal(parseClicksignWebhookEvent({ event: { name: 'sign' } }), null);
  assert.equal(parseClicksignWebhookEvent(null), null);
});

test('maps Clicksign envelope terminal states to contract statuses', () => {
  assert.deepEqual(clicksignContractStatus('closed'), { status: 'Assinado', tone: 'green' });
  assert.deepEqual(clicksignContractStatus('canceled'), { status: 'Cancelado', tone: 'gray' });
  assert.deepEqual(clicksignContractStatus('running'), { status: 'Aguardando assinatura', tone: 'amber' });
});

test('maps signed Clicksign event names without trusting a delayed API poll', () => {
  assert.equal(clicksignWebhookEnvelopeStatus({ name: 'document_closed', documentId: '', envelopeId: '', documentStatus: '' }), 'closed');
  assert.equal(clicksignWebhookEnvelopeStatus({ name: 'refusal', documentId: '', envelopeId: '', documentStatus: '' }), 'canceled');
  assert.equal(clicksignWebhookEnvelopeStatus({ name: 'deadline', documentId: '', envelopeId: '', documentStatus: 'closed' }), 'closed');
  assert.equal(clicksignWebhookEnvelopeStatus({ name: 'deadline', documentId: '', envelopeId: '', documentStatus: 'canceled' }), 'canceled');
  assert.equal(clicksignWebhookEnvelopeStatus({ name: 'sign', documentId: '', envelopeId: '', documentStatus: 'running' }), 'running');
});

test('does not let a delayed nonterminal Clicksign event undo a terminal contract status', () => {
  assert.equal(canApplyClicksignWebhookStatus('Assinado', 'Aguardando assinatura'), false);
  assert.equal(canApplyClicksignWebhookStatus('Cancelado', 'Aguardando assinatura'), false);
  assert.equal(canApplyClicksignWebhookStatus('Aguardando assinatura', 'Assinado'), true);
  assert.equal(canApplyClicksignWebhookStatus('Assinado', 'Assinado'), true);
});

test('requires an active Clicksign webhook on the exact endpoint with all status events', () => {
  const events = ['document_closed', 'auto_close', 'close', 'cancel', 'deadline', 'refusal', 'sign'];
  const configured = [{ id: 'wh-1', attributes: { endpoint: 'https://focussdev.space/api/integrations/clicksign/webhook', status: 'active', events } }];
  assert.equal(clicksignWebhookIsReady(configured, 'https://focussdev.space/api/integrations/clicksign/webhook', events), true);
  assert.equal(clicksignWebhookIsReady(configured, 'https://wrong.example/webhook', events), false);
  assert.equal(clicksignWebhookIsReady([{ ...configured[0], attributes: { ...configured[0]!.attributes, status: 'inactive' } }], 'https://focussdev.space/api/integrations/clicksign/webhook', events), false);
  assert.equal(clicksignWebhookIsReady([{ ...configured[0], attributes: { ...configured[0]!.attributes, events: ['sign'] } }], 'https://focussdev.space/api/integrations/clicksign/webhook', events), false);
  assert.equal(clicksignWebhookIsReady(null, 'https://focussdev.space/api/integrations/clicksign/webhook', events), false);
});
