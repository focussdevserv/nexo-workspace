import test from 'node:test';
import assert from 'node:assert/strict';
import { contractText, editableContractStatuses, isLockedContractStatus } from '../../src/data/contract-document.js';
import { isUnverifiedContractTransition, requiresExternalSignature } from '../src/contracts/status.js';

test('does not allow manual transitions to unsigned or active contract states', () => {
  assert.deepEqual(editableContractStatuses, ['Rascunho', 'Concluído', 'Cancelado']);
  for (const status of ['Aguardando assinatura', 'Assinado', 'Ativo']) {
    assert.equal(editableContractStatuses.includes(status), false);
    assert.equal(isLockedContractStatus(status), true);
  }
});

test('generates a readable contract draft with its review placeholders', () => {
  const document = contractText({ title: 'Site institucional', client: 'Cliente A', scope: 'Site institucional', value: 'R$ 4.500' });
  assert.match(document, /CONTRATO DE PRESTAÇÃO DE SERVIÇOS DIGITAIS/);
  assert.match(document, /Cliente A/);
  assert.match(document, /R\$ 4\.500/);
  assert.match(document, /MODELO BASE/);
  assert.doesNotMatch(document, /undefined|null/);
});

test('API policy requires an external signature event before activating a contract', () => {
  assert.equal(requiresExternalSignature('Assinado'), true);
  assert.equal(requiresExternalSignature('Ativo'), true);
  assert.equal(isUnverifiedContractTransition('Rascunho', 'Assinado'), true);
  assert.equal(isUnverifiedContractTransition('Assinado', 'Assinado'), false);
  assert.equal(isUnverifiedContractTransition('Rascunho', 'Concluído'), false);
  assert.equal(requiresExternalSignature('Rascunho'), false);
});
