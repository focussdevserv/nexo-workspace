import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFinanceClientLink } from './finance-client-link.js';

test('keeps a selected client link when lookup is ready and blocks premature saves', () => {
  const clients = [{ id: 'client-1', name: 'Acme' }];
  assert.deepEqual(resolveFinanceClientLink('client-1', clients, true), {
    error: 'Aguarde a lista de clientes carregar antes de salvar o vinculo.',
  });
  assert.deepEqual(resolveFinanceClientLink('client-1', clients, false), {
    clientId: 'client-1', counterparty: 'Acme',
  });
});

test('rejects stale client selections instead of silently saving an unlinked finance record', () => {
  assert.match(resolveFinanceClientLink('removed-client', [], false).error, /nao esta disponivel/);
});

test('keeps standalone finance counterparties unlinked when no client was selected', () => {
  assert.deepEqual(resolveFinanceClientLink('', [], true, 'Fornecedor X'), {
    clientId: null, counterparty: 'Fornecedor X',
  });
});
