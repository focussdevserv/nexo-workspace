import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyWahaQrResponse } from '../src/integrations/waha.ts';

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
