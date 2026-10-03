import assert from 'node:assert/strict';
import test from 'node:test';
import { repositoryConnectionState } from './repository-connection.js';

test('does not present a pending or failed status request as disconnected', () => {
  assert.equal(repositoryConnectionState({ loading: true }).label, 'Consultando…');
  assert.deepEqual(repositoryConnectionState({ error: 'API indisponível' }), {
    label: 'Indisponível', hint: 'API indisponível', available: false,
  });
});

test('distinguishes missing, disabled, configured, and verified GitHub credentials', () => {
  assert.equal(repositoryConnectionState().label, 'Não conectado');
  assert.equal(repositoryConnectionState({ status: { configured: true, enabled: false } }).label, 'Desconectado');
  assert.equal(repositoryConnectionState({ status: { configured: true, enabled: true } }).label, 'Token presente');
  assert.equal(repositoryConnectionState({ status: { configured: true, enabled: true, lastTestStatus: 'connected' } }).available, true);
});

test('surfaces a failed or incomplete GitHub test without hiding the available retry action', () => {
  assert.deepEqual(repositoryConnectionState({ status: {
    configured: true, enabled: true, lastTestStatus: 'error', lastTestMessage: 'GitHub respondeu com HTTP 401.',
  } }), {
    label: 'Falha no teste', hint: 'GitHub respondeu com HTTP 401.', available: true,
  });
  assert.deepEqual(repositoryConnectionState({ status: { configured: true, enabled: true, lastTestStatus: 'setup_required' } }), {
    label: 'Configuração pendente', hint: 'A conexão precisa de uma configuração adicional.', available: true,
  });
});
