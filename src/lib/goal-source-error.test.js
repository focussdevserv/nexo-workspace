import assert from 'node:assert/strict';
import test from 'node:test';
import { goalSourceErrorState } from './goal-source-error.js';

test('recognizes structured permission failures from the API', () => {
  assert.equal(goalSourceErrorState({ code: 'forbidden' }), 'restricted');
  assert.equal(goalSourceErrorState({ details: { status: 403 } }), 'restricted');
  assert.equal(goalSourceErrorState({ status: 403 }), 'restricted');
});

test('recognizes permission messages but keeps network and server errors unavailable', () => {
  assert.equal(goalSourceErrorState(new Error('Você não tem permissão para ler este módulo.')), 'restricted');
  assert.equal(goalSourceErrorState(new Error('Falha de rede')), 'failed');
  assert.equal(goalSourceErrorState({ code: 'internal_error', details: { status: 500 } }), 'failed');
});
