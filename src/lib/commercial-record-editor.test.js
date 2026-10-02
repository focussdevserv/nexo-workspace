import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommercialRecordEditorPatch,
  commercialRecordEditorDraft,
  commercialRecordEditorFields,
  commercialRecordEditorIsDirty,
} from './commercial-record-editor.js';

const clients = [{ id: 12, name: 'Nexo Ltda', email: 'financeiro@nexo.test' }];

test('exposes editable business fields for companies and contacts', () => {
  assert.deepEqual(commercialRecordEditorFields('empresas').map(({ key }) => key), ['name', 'segment', 'city', 'size']);
  assert.deepEqual(commercialRecordEditorFields('contatos').map(({ key }) => key), ['name', 'company', 'role', 'email', 'phone', 'last']);
});

test('keeps draft values as strings and detects unsaved changes', () => {
  const record = { id: 1, name: 'Acme', city: 'São Paulo' };
  const draft = commercialRecordEditorDraft('empresas', record);
  assert.equal(commercialRecordEditorIsDirty('empresas', record, draft), false);
  assert.equal(commercialRecordEditorIsDirty('empresas', record, { ...draft, city: 'Santos' }), true);
});

test('validates and links proposal client fields before saving', () => {
  const result = buildCommercialRecordEditorPatch('propostas', {
    title: 'Auditoria', clientId: '12', email: '', value: 'R$ 2.500,00', service: 'CRM',
    deadline: '30 dias', paymentTerms: 'Mensal', scope: 'Revisão geral',
  }, clients);
  assert.equal(result.error, undefined);
  assert.equal(result.patch.clientId, 12);
  assert.equal(result.patch.client, 'Nexo Ltda');
  assert.equal(result.patch.name, 'Auditoria');
  assert.equal(result.patch.email, 'financeiro@nexo.test');
  assert.equal(result.patch.scope, 'Revisão geral');
});

test('rejects missing client, malformed email and out-of-range contract progress', () => {
  assert.match(buildCommercialRecordEditorPatch('contratos', { title: 'CTR', clientId: 'missing', progress: '0' }, []).error, /cliente cadastrado/i);
  const badEmail = buildCommercialRecordEditorPatch('contatos', { name: 'Ana', email: 'ana@' });
  assert.match(badEmail.error, /e-mail válido/i);
  const badProgress = buildCommercialRecordEditorPatch('contratos', {
    title: 'CTR', clientId: '12', progress: '101',
  }, clients);
  assert.match(badProgress.error, /entre 0 e 100/i);
});

test('requires titles and preserves numeric contract progress', () => {
  const missing = buildCommercialRecordEditorPatch('propostas', { title: '', clientId: '12' }, clients);
  assert.match(missing.error, /título da proposta/i);
  const valid = buildCommercialRecordEditorPatch('contratos', {
    title: 'Contrato mensal', clientId: '12', progress: '45',
  }, clients);
  assert.equal(valid.patch.progress, 45);
});

test('rejects malformed proposal prices without modifying the original record', () => {
  const record = { id: 3, title: 'Proposta', client: 'Nexo Ltda', clientId: 12 };
  const draft = {
    title: 'Proposta', clientId: '12', value: 'R$ 12,xx', scope: 'Escopo',
  };
  const result = buildCommercialRecordEditorPatch('propostas', draft, clients, record);
  assert.match(result.error, /valor válido/i);
  assert.equal(record.title, 'Proposta');
});
