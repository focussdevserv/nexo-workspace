import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { automationN8nLinkState } from './automation-n8n-link-state.js';

test('uses current n8n workflow state instead of stale automation record state', () => {
  const linkedModel = { n8nWorkflowId: 'wf-1', active: true };
  assert.deepEqual(automationN8nLinkState(linkedModel, { workflows: [{ id: 'wf-1', active: false }] }), {
    state: 'draft', label: 'Rascunho no n8n', active: false,
  });
  assert.deepEqual(automationN8nLinkState({ ...linkedModel, active: false }, { workflows: [{ id: 'wf-1', active: true }] }), {
    state: 'published', label: 'Publicado no n8n', active: true,
  });
});

test('does not claim a linked workflow state while loading, after errors, or when not in the loaded page', () => {
  const linkedModel = { n8nWorkflowId: 'wf-1', active: true };
  assert.equal(automationN8nLinkState(linkedModel, { loading: true }).state, 'unknown');
  assert.equal(automationN8nLinkState(linkedModel, { error: 'offline' }).label, 'Estado do n8n indisponível');
  assert.equal(automationN8nLinkState(linkedModel, { workflows: [{ id: 'wf-2', active: true }] }).label, 'Workflow ainda não carregado');
});

test('labels unlinked models as local instead of implying they run in n8n', () => {
  assert.deepEqual(automationN8nLinkState({ active: true }), { state: 'local', label: 'Modelo local', active: false });
  assert.deepEqual(automationN8nLinkState({ active: true }, { localDemo: true }), { state: 'local', label: 'Modelo simulado', active: false });
});

test('automation cards use provider state for labels and removal confirmation', async () => {
  const screen = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  assert.match(screen, /automationN8nLinkState\(item, \{ workflows: n8nData\?\.workflows/);
  assert.match(screen, /\{remoteState\.label\}/);
  assert.match(screen, /Estado consultado do workflow remoto: \$\{remoteState\.label\}/);
});
