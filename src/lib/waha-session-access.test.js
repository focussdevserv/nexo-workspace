import assert from 'node:assert/strict';
import test from 'node:test';
import { canManageWahaSessions, canOfferWahaConnectAction, canShowWahaQr, preserveWahaSessionsOnRefreshError, wahaIntegrationAvailability, wahaQrSessionMessage, wahaSessionStatusLabel, wahaSessionStatusSummary } from './waha-session-access.js';

test('WAHA readiness prevents session requests until configured and enabled', () => {
  assert.deepEqual(wahaIntegrationAvailability([]), { state: 'not_configured', message: 'Configure o WAHA em Integrações antes de adicionar números.' });
  assert.equal(wahaIntegrationAvailability([{ provider: 'waha', configured: true, enabled: false }]).state, 'disconnected');
  assert.equal(wahaIntegrationAvailability([{ name: 'WAHA', configured: true, enabled: true }]).state, 'ready');
});

test('session management and QR pairing are limited to the owner role', () => {
  assert.equal(canManageWahaSessions('owner'), true);
  assert.equal(canManageWahaSessions('admin'), false);
  assert.equal(canManageWahaSessions('member'), false);
  assert.equal(canShowWahaQr('owner', 'SCAN_QR_CODE'), true);
  assert.equal(canShowWahaQr('admin', 'SCAN_QR_CODE'), false);
  assert.equal(canShowWahaQr('owner', 'WORKING'), false);
});

test('session actions offer one connect action only for states that need QR or recovery', () => {
  assert.equal(canOfferWahaConnectAction('SCAN_QR_CODE'), true);
  assert.equal(canOfferWahaConnectAction('FAILED'), true);
  assert.equal(canOfferWahaConnectAction('NOT_FOUND'), true);
  assert.equal(canOfferWahaConnectAction('STOPPED'), false);
  assert.equal(canOfferWahaConnectAction('STARTING'), false);
  assert.equal(canOfferWahaConnectAction('WORKING'), false);
});

test('paused sessions do not claim to be waiting for a QR code', () => {
  assert.match(wahaQrSessionMessage('STOPPED'), /pausada/i);
  assert.match(wahaQrSessionMessage('STARTING'), /iniciando/i);
  assert.match(wahaQrSessionMessage('SCAN_QR_CODE'), /aguardando QR/i);
});

test('WAHA outages replace cached connection states with an explicit unavailable state', () => {
  const sessions = [{ status: 'WORKING' }, { status: 'FAILED' }];
  assert.equal(wahaSessionStatusLabel('WORKING', true), 'Status indisponível');
  assert.deepEqual(wahaSessionStatusSummary(sessions, true), { connected: '—', needsAction: '—' });
  assert.equal(wahaSessionStatusLabel('WORKING'), 'Conectado');
  assert.deepEqual(wahaSessionStatusSummary(sessions), { connected: '1', needsAction: '1' });
});

test('a temporary WAHA refresh error preserves known sessions and exposes an error', () => {
  const sessions = [{ id: 'session-1', status: 'WORKING' }];
  const state = preserveWahaSessionsOnRefreshError(sessions, new Error('WAHA temporariamente indisponível'));
  assert.equal(state.sessions, sessions);
  assert.equal(state.error, 'WAHA temporariamente indisponível');
  assert.deepEqual(preserveWahaSessionsOnRefreshError(null, null), {
    sessions: [],
    error: 'Não foi possível consultar as sessões WhatsApp.',
  });
});
