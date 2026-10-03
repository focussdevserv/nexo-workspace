import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommercialRecordEditorPatch,
  companyContactCount,
  commercialRecordEditorDraft,
  commercialRecordEditorFields,
  commercialRecordEditorIsDirty,
} from './commercial-record-editor.js';

const clients = [{ id: 12, name: 'Nexo Ltda', email: 'financeiro@nexo.test' }];
const companies = [{ id: 34, name: 'Acme Tecnologia' }];

test('exposes editable business fields for companies and contacts', () => {
  assert.deepEqual(commercialRecordEditorFields('empresas').map(({ key }) => key), ['name', 'segment', 'city', 'size', 'email', 'phone', 'website', 'address', 'notes']);
  assert.deepEqual(commercialRecordEditorFields('contatos').map(({ key }) => key), ['name', 'companyId', 'company', 'role', 'email', 'phone', 'last']);
});

test('company editor validates and persists its contact and location details', () => {
  const result = buildCommercialRecordEditorPatch('empresas', {
    name: 'Acme Tecnologia', segment: 'Tecnologia', city: 'São Paulo', size: '11–50',
    email: 'contato@acme.test', phone: '+55 11 90000-0000', website: 'https://acme.test',
    address: 'Rua Exemplo, 10', notes: 'Renovar cadastro em janeiro',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.patch.email, 'contato@acme.test');
  assert.equal(result.patch.phone, '+55 11 90000-0000');
  assert.equal(result.patch.website, 'https://acme.test');
  assert.equal(result.patch.address, 'Rua Exemplo, 10');
  assert.equal(result.patch.notes, 'Renovar cadastro em janeiro');

  const invalidEmail = buildCommercialRecordEditorPatch('empresas', {
    name: 'Acme Tecnologia', email: 'endereco-invalido',
  });
  assert.match(invalidEmail.error, /e-mail/i);
});

test('contact editor links a registered company and preserves legacy free-text companies', () => {
  const legacyContact = { id: 'contact-1', name: 'Ana', company: 'Acme Tecnologia' };
  const legacyDraft = commercialRecordEditorDraft('contatos', legacyContact, [], companies);
  assert.equal(legacyDraft.companyId, '34');
  assert.equal(commercialRecordEditorIsDirty('contatos', legacyContact, legacyDraft, [], companies), false);
  const linked = buildCommercialRecordEditorPatch('contatos', {
    name: 'Ana', companyId: '34', company: 'Acme Tecnologia', role: 'Diretora', email: '', phone: '', last: '',
  }, [], legacyContact, [], companies);
  assert.equal(linked.error, undefined);
  assert.equal(linked.patch.companyId, 34);
  assert.equal(linked.patch.company, 'Acme Tecnologia');

  const unlinked = buildCommercialRecordEditorPatch('contatos', {
    name: 'Ana', companyId: '', company: 'Consultoria sem cadastro', role: 'Diretora', email: '', phone: '', last: '',
  }, [], legacyContact, [], companies);
  assert.equal(unlinked.error, undefined);
  assert.equal(unlinked.patch.companyId, '');
  assert.equal(unlinked.patch.company, 'Consultoria sem cadastro');
});

test('contact editor rejects a company identifier outside the loaded company list', () => {
  const result = buildCommercialRecordEditorPatch('contatos', {
    name: 'Ana', companyId: 'missing', company: 'Acme Tecnologia', role: '', email: '', phone: '', last: '',
  }, [], {}, [], companies);
  assert.match(result.error, /empresa cadastrada/i);
});

test('company contact counts use linked IDs and only unambiguous legacy names', () => {
  const otherCompany = { id: 35, name: 'Outra Empresa' };
  const contacts = [
    { companyId: '34', company: 'Acme Tecnologia' },
    { company: 'Acme Tecnologia' },
    { companyId: '35', company: 'Acme Tecnologia' },
    { company: 'Fornecedor' },
  ];
  assert.equal(companyContactCount(companies[0], contacts, [...companies, otherCompany]), 2);
  const duplicateNameCompany = { id: 36, name: 'Acme Tecnologia' };
  assert.equal(companyContactCount(companies[0], contacts, [...companies, duplicateNameCompany, otherCompany]), 1);
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
