import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWahaQrResponse, classifyWahaSessionReadiness } from '../src/integrations/waha.ts';

test('treats an expired or unavailable QR challenge as a pending session state', () => {
  assert.equal(classifyWahaQrResponse(204), 'pending');
  assert.equal(classifyWahaQrResponse(404), 'pending');
  assert.equal(classifyWahaQrResponse(422), 'pending');
});

test('accepts image responses and rejects provider failures without parsing their bodies', () => {
  assert.equal(classifyWahaQrResponse(200, 'image/png'), 'image');
  assert.equal(classifyWahaQrResponse(200, 'image/png; charset=binary'), 'image');
  assert.equal(classifyWahaQrResponse(401, 'application/json'), 'error');
  assert.equal(classifyWahaQrResponse(502, 'text/plain'), 'error');
  assert.equal(classifyWahaQrResponse(200, 'application/json'), 'pending');
});

test('reports WhatsApp connected only when a managed WAHA session is working', () => {
  assert.equal(classifyWahaSessionReadiness([{ status: 'WORKING' }]).status, 'connected');
  assert.equal(classifyWahaSessionReadiness([{ status: 'WORKING' }, { status: 'SCAN_QR_CODE' }]).working, 1);
});

test('distinguishes QR pairing and paused sessions from a connected WhatsApp number', () => {
  const qr = classifyWahaSessionReadiness([{ status: 'SCAN_QR_CODE' }]);
  assert.equal(qr.status, 'setup_required');
  assert.match(qr.message, /aguardam leitura do QR/);
  assert.equal(classifyWahaSessionReadiness([{ status: 'STOPPED' }]).status, 'setup_required');
  assert.equal(classifyWahaSessionReadiness([]).status, 'setup_required');
});
