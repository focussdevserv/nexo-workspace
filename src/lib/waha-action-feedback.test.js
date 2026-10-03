import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { wahaActionFeedback } from './waha-action-feedback.js';

test('does not claim a real session action was confirmed when the refresh failed', () => {
  const message = wahaActionFeedback('stop', { statusConfirmed: false });
  assert.match(message, /aceitou a ação, mas o status não foi confirmado/i);
  assert.match(message, /antes de repetir/i);
  assert.doesNotMatch(message, /sessão pausada/i);
});

test('uses precise success feedback after confirmation and marks local actions as simulated', () => {
  assert.equal(wahaActionFeedback('stop'), 'sessão pausada; o vínculo do celular foi preservado.');
  assert.equal(wahaActionFeedback('logout', { localDemo: true }), 'Simulação local: WhatsApp desconectado. Leia o novo QR para vincular novamente.');
  assert.match(wahaActionFeedback('start', { localDemo: true, statusConfirmed: false }), /simulação aceitou a ação/i);
});

test('WAHA action feedback is based on the result of the post-action refresh', async () => {
  const screen = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  assert.match(screen, /const refreshed = await refresh\(\{ clearError: true \}\)/);
  assert.match(screen, /wahaActionFeedback\(action, \{ statusConfirmed: refreshed\?\.ok === true, localDemo \}\)/);
});
